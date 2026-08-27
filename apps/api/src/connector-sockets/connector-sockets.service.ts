import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  CONTRACTS_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  type Descriptor,
  type ErrorEnvelope,
  type Notification,
} from "@repanel/contracts";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { ConnectorOfflineError } from "../errors/domain-errors";
import { ConnectorChannel, type Answerer, type ConnectorResult } from "./connector-channel";
import { CONNECTOR_TOKEN_PATTERN, hashConnectorToken } from "./connector-token";
import { ConnectorTokensRepository } from "./connector-tokens.repository";

/** Where a connector dials. Nothing else on this API is a WebSocket. */
export const CONNECTOR_PATH = "/connector";

/** The version this build speaks, stated by both ends before a socket exists. */
export const CONTRACTS_VERSION_HEADER = "x-repanel-contracts-version";

/**
 * Room for the largest page an admin asks for — a hundred records of a
 * customer's own columns — and no room for anything that could only be a
 * mistake.
 */
const MAX_FRAME_BYTES = 4 * 1024 * 1024;

/** Its token is no longer the one this project's connector dials with. */
const REVOKED = 4001;

/** Another connector connected for this project, and the newest one wins. */
const REPLACED = 4002;

/** Nothing was heard from it for three heartbeats. */
const SILENT = 4003;

/** One answer for every unusable token: a caller must not learn which part was wrong. */
const REFUSAL = "Connector token is invalid";

/**
 * Every connector holding a channel open, and the only place one is accepted.
 *
 * It is transport and nothing else. It knows how a connector authenticates, how
 * a frame is correlated with the request that is waiting for it, and when a
 * silent socket has been silent too long — and it knows nothing about what a
 * descriptor asks for or what a definition is. That is deliberate: the
 * definitions feature announces a publish through here without depending on the
 * feature that serves a request, and neither has to know about the other.
 *
 * The registry is this process's. A second API replica would hold its own
 * sockets and see none of these, which is a limit of this rung rather than an
 * oversight — multi-connector high availability is a rung above it, and is
 * written down in the threat model rather than designed around here.
 */
@Injectable()
export class ConnectorSocketsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ConnectorSocketsService.name);
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  private readonly channels = new Map<string, ConnectorChannel>();
  private sweep?: NodeJS.Timeout;
  private answerer: Answerer = () => Promise.reject(new Error("Nothing is answering connector questions"));

  constructor(
    private readonly tokens: ConnectorTokensRepository,
    private readonly adapters: HttpAdapterHost,
  ) {}

  /**
   * What answers a connector's own questions. Registered by the feature that
   * knows what they mean, in `onModuleInit`, which Nest runs before every
   * module's `onApplicationBootstrap` — so nothing can connect before there is
   * something to answer it.
   */
  answerQuestions(answerer: Answerer): void {
    this.answerer = answerer;
  }

  onApplicationBootstrap(): void {
    const server = this.adapters.httpAdapter?.getHttpServer() as Server | undefined;
    if (!server) return;

    server.on("upgrade", (request, socket, head) => {
      void this.upgrade(request, socket as Duplex, head);
    });

    this.sweep = setInterval(() => this.dropTheSilent(), HEARTBEAT_INTERVAL_MS);
    // A timer must not be the reason a process stays up.
    this.sweep.unref();
  }

  /** Whether a connector is holding a channel open for this project right now. */
  isConnected(projectId: string): boolean {
    return this.channels.has(projectId);
  }

  /** The last heartbeat from a live connector, or nothing if none is connected. */
  lastSeenAt(projectId: string): Date | undefined {
    return this.channels.get(projectId)?.lastSeenAt;
  }

  /**
   * Serves one request through this project's connector. The deadline belongs
   * to the caller: what is a reasonable wait depends on what was asked, and the
   * one rule this enforces nowhere is enforced everywhere it matters — the hop
   * is always given longer than the statement inside it.
   */
  execute(
    projectId: string,
    definitionVersion: number,
    descriptor: Descriptor,
    timeoutMs: number,
  ): Promise<ConnectorResult> {
    const channel = this.channels.get(projectId);
    if (!channel) {
      return Promise.reject(
        new ConnectorOfflineError(
          "The connector for this project is not connected, so nothing was asked of its database.",
        ),
      );
    }

    return channel.execute(definitionVersion, descriptor, timeoutMs);
  }

  /**
   * Tells a project's connector something, if one is listening. A publish while
   * nobody is connected is not lost: a connector pulls the definition as it
   * opens its session, so the next one to connect is current by construction.
   */
  notify(projectId: string, notification: Notification): void {
    this.channels.get(projectId)?.notify(notification);
  }

  /** Turns away the connector a project has, because its token no longer stands. */
  revoke(projectId: string): void {
    this.channels.get(projectId)?.close(REVOKED, "token revoked");
  }

  onModuleDestroy(): void {
    if (this.sweep) clearInterval(this.sweep);
    for (const channel of this.channels.values()) channel.close(SILENT, "shutting down");
    this.channels.clear();
    this.sockets.close();
  }

  /**
   * One connector arriving. Both refusals happen here, before a socket exists:
   * a build that speaks a different contract and a caller with no usable token
   * are turned away with an answer they can read, rather than with a channel
   * that half works.
   */
  private async upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (new URL(request.url ?? "/", "http://connector").pathname !== CONNECTOR_PATH) {
      // Nothing else on this API is a WebSocket, so an upgrade anywhere else is
      // a request nobody is going to answer.
      return refuse(socket, 404, "Not Found", "not_found", "Not found");
    }

    const projectId = await this.projectFor(bearerTokenFrom(request));
    if (!projectId) return refuse(socket, 401, "Unauthorized", "unauthorized", REFUSAL);

    const stated = request.headers[CONTRACTS_VERSION_HEADER];
    if (stated !== CONTRACTS_VERSION) {
      // Loud, and loud on this end too: a connector that half-understands a
      // frame is worse than one that was turned away, and a refusal nobody
      // records is one nobody fixes (DECISIONS #064).
      this.logger.warn(
        `connector_version_mismatch: project ${projectId} dialled with contracts ` +
          `${typeof stated === "string" ? stated : "(unstated)"}; this deployment speaks ${CONTRACTS_VERSION}`,
      );
      return refuse(
        socket,
        426,
        "Upgrade Required",
        "connector_version_mismatch",
        `This connector was built against RePanel contracts ${typeof stated === "string" ? stated : "(unstated)"}, ` +
          `and this deployment speaks ${CONTRACTS_VERSION}. Update the connector and run it again.`,
      );
    }

    this.sockets.handleUpgrade(request, socket, head, (connection) => {
      // The newest connector wins. A crashed one can leave a socket that is
      // open as far as this end is concerned, and an operator restarting it
      // must not have to wait out a heartbeat to be let back in.
      const replaced = this.channels.get(projectId);
      if (replaced) replaced.close(REPLACED, "another connector connected for this project");

      const channel = new ConnectorChannel(projectId, connection, this.answerer, (project, problem) =>
        this.logger.warn(`Connector for project ${project} ${problem}`),
      );
      this.channels.set(projectId, channel);

      // The one place a channel is unregistered, whatever ended it — a
      // heartbeat that stopped, a token that was revoked, a connector that was
      // replaced, or a process that went away. The identity check is what
      // stops a replaced channel's own close from evicting its replacement.
      connection.on("close", () => {
        if (this.channels.get(projectId) !== channel) return;
        this.channels.delete(projectId);
        void this.tokens.recordSeen(projectId).catch(() => undefined);
        this.logger.log(`Connector disconnected for project ${projectId}`);
      });

      void this.tokens.recordSeen(projectId).catch(() => undefined);
      this.logger.log(`Connector connected for project ${projectId}`);
    });
  }

  /** The project a token speaks for, or nothing. Shape first, so a malformed
   *  header never reaches the database. */
  private async projectFor(token: string | undefined): Promise<string | undefined> {
    if (!token || !CONNECTOR_TOKEN_PATTERN.test(token)) return undefined;

    const found = await this.tokens.findByHash(hashConnectorToken(token));
    return found?.projectId;
  }

  /** Three heartbeats of silence is gone, whatever the socket still believes. */
  private dropTheSilent(): void {
    const cutoff = Date.now() - HEARTBEAT_TIMEOUT_MS;

    for (const [projectId, channel] of this.channels) {
      if (channel.lastSeenAt.getTime() > cutoff) continue;
      this.logger.warn(`Connector for project ${projectId} stopped sending heartbeats`);
      channel.close(SILENT, "no heartbeat");
    }
  }
}

/** The token a request carries, if it carries one. */
function bearerTokenFrom(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;

  const token = header.slice("Bearer ".length).trim();
  return token === "" ? undefined : token;
}

/**
 * Turns a connector away before the handshake. The body is the same envelope
 * every other refusal on this API uses, so the connector can read why it was
 * refused and say so at the terminal it was started from.
 */
function refuse(socket: Duplex, status: number, statusText: string, code: string, message: string): void {
  const envelope: ErrorEnvelope = { error: { code, message } };
  const body = JSON.stringify(envelope);

  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\n` +
      "content-type: application/json\r\n" +
      `content-length: ${Buffer.byteLength(body)}\r\n` +
      "connection: close\r\n\r\n" +
      body,
  );
  socket.destroy();
}
