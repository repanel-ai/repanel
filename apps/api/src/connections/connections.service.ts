import { Injectable } from "@nestjs/common";
import type {
  ConnectionDto,
  ConnectionKind,
  ConnectionTestDto,
  MintedConnectorTokenDto,
  SetConnectionRequest,
} from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import {
  createConnectorToken,
  hashConnectorToken,
} from "../connector-sockets/connector-token";
import { ConnectorTokensRepository } from "../connector-sockets/connector-tokens.repository";
import { CryptoService } from "../crypto/crypto.service";
import { NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { ConnectionProbeService } from "./connection-probe.service";
import { toConnectionDto } from "./connections.mapper";
import {
  ConnectionsRepository,
  NO_CONNECTION,
  NO_DSN,
  type ConnectionRow,
} from "./connections.repository";
import { CustomerPoolService } from "./customer-pool.service";

/**
 * Owns the one database a project points at, and which of the two ways it is
 * reached by.
 *
 * A connection string passes through here twice — inward to be encrypted,
 * outward to be tested — and leaves in neither direction: a caller is told what
 * its connection reaches, never how to reach it. A connector never hands one
 * over at all, which is the whole of what that rung is for: what this feature
 * holds for it is a token digest, and what it can say about it is whether it is
 * there (DECISIONS #064).
 *
 * One project points one way at a time. Choosing a rung replaces the other,
 * takes the credential the other one used with it, and lets go of anything the
 * other one had open.
 */
@Injectable()
export class ConnectionsService {
  constructor(
    private readonly repository: ConnectionsRepository,
    private readonly projects: ProjectsService,
    private readonly crypto: CryptoService,
    private readonly probe: ConnectionProbeService,
    private readonly pools: CustomerPoolService,
    private readonly tokens: ConnectorTokensRepository,
    private readonly sockets: ConnectorSocketsService,
  ) {}

  /** Points a project at a database, replacing whatever it pointed at before. */
  async set(
    ownerId: string,
    projectId: string,
    { dsn }: SetConnectionRequest,
  ): Promise<ConnectionDto> {
    await this.projects.requireMember(projectId, ownerId, "owner");

    const saved = await this.repository.save({
      projectId,
      kind: "postgres-direct",
      encryptedDsn: this.crypto.encrypt(dsn),
    });
    // The pool the replaced DSN opened must not outlive the DSN itself.
    await this.pools.release(projectId);
    // Nor may a connector outlive the rung it was minted for: a project that
    // now holds its own connection string is not one anybody dials into.
    await this.stopConnector(projectId);

    return toConnectionDto(saved, { dsn });
  }

  /**
   * Puts this project on the connector rung and mints the credential its
   * connector dials with. The token is returned here and nowhere else, ever —
   * only its digest is kept — and minting again replaces it, which is how one
   * is revoked.
   */
  async useConnector(ownerId: string, projectId: string): Promise<MintedConnectorTokenDto> {
    await this.projects.requireMember(projectId, ownerId, "owner");

    await this.repository.save({ projectId, kind: "connector", encryptedDsn: null });
    // Whatever this project's connection string had open is no longer this
    // project's business, and RePanel is not keeping it.
    await this.pools.release(projectId);

    const token = createConnectorToken();
    await this.tokens.save(projectId, hashConnectorToken(token));
    // The connector holding a channel open dialled in with the token that was
    // just replaced, so it is no longer one this project accepts.
    this.sockets.revoke(projectId);

    return { token };
  }

  /**
   * What this project's connection reaches, or null while it reaches nothing.
   * A DSN is decrypted only to be taken apart: what leaves is the host and the
   * database name, which is what a human needs to recognize it by.
   */
  async get(ownerId: string, projectId: string): Promise<ConnectionDto | null> {
    await this.projects.requireMember(projectId, ownerId, "owner");

    const connection = await this.repository.findByProjectId(projectId);
    if (!connection) return null;

    if (connection.kind === "connector") return toConnectionDto(connection, await this.presence(projectId));
    return toConnectionDto(connection, { dsn: this.crypto.decrypt(requireDsn(connection)) });
  }

  /** Whether the stored connection string actually works, answered in categories. */
  async test(ownerId: string, projectId: string): Promise<ConnectionTestDto> {
    await this.projects.requireMember(projectId, ownerId, "owner");
    const connection = await this.requireConnection(projectId);

    return this.probe.check(this.crypto.decrypt(requireDsn(connection)));
  }

  /**
   * How this project's database is reached. No authorization: every caller was
   * authorized long before it got here, and this is asked on the path of every
   * record an operator reads.
   */
  async kindFor(projectId: string): Promise<ConnectionKind> {
    return (await this.requireConnection(projectId)).kind;
  }

  /**
   * Whether a project has a connection at all. It is what an authoring agent
   * needs in order to know whether it can inspect anything, and it is all such
   * a caller is told — where the database is is a human's business.
   */
  async hasConnection(principal: Principal, projectId: string): Promise<boolean> {
    await this.projects.requireAccess(principal, projectId, "owner");

    return (await this.repository.findByProjectId(projectId)) !== undefined;
  }

  /**
   * Whether a connector is there, and when it was last heard from. The live
   * answer is the heartbeat this process is receiving; the filed one is what
   * the last heartbeat left behind, which is what survives a restart of either
   * end.
   */
  private async presence(projectId: string): Promise<{ connected: boolean; lastSeenAt: Date | null }> {
    const live = this.sockets.lastSeenAt(projectId);
    if (live) return { connected: true, lastSeenAt: live };

    const token = await this.tokens.findByProjectId(projectId);
    return { connected: false, lastSeenAt: token?.lastSeenAt ?? null };
  }

  /** Ends a project's connector and takes its credential with it. */
  private async stopConnector(projectId: string): Promise<void> {
    this.sockets.revoke(projectId);
    await this.tokens.deleteByProjectId(projectId);
  }

  private async requireConnection(projectId: string): Promise<ConnectionRow> {
    const connection = await this.repository.findByProjectId(projectId);
    if (!connection) throw new NotFoundError(NO_CONNECTION);
    return connection;
  }
}

/**
 * The ciphertext of a project's connection string. A connector row has none —
 * the table's own check constraint says so — and asking for one there is asking
 * the wrong question rather than finding a missing value.
 */
function requireDsn(connection: ConnectionRow): string {
  if (!connection.encryptedDsn) throw new NotFoundError(NO_DSN);
  return connection.encryptedDsn;
}
