import {
  CONTRACTS_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  cloudFrameSchema,
  type Answer,
  type CloudFrame,
  type ConnectorFrame,
  type ErrorEnvelope,
  type Question,
} from "@repanel/contracts";
import type { Pool } from "pg";
import { WebSocket } from "ws";
import { serve, type ConnectorEngine } from "./dispatch.js";
import { ConnectorSession, UnservableDefinition } from "./session.js";

/** The header Cloud reads a connector's build off, before the handshake. */
const CONTRACTS_VERSION_HEADER = "x-repanel-contracts-version";

/** The first wait after losing the channel, and the longest one. */
const FIRST_RETRY_MS = 1_000;
const LONGEST_RETRY_MS = 30_000;

/** Close codes Cloud states a reason with. Three of them end the process. */
const REVOKED = 4001;
const REPLACED = 4002;
const UNSUPPORTED_DATA = 1003;

/** How long Cloud is given to answer a question of ours before we give up on it. */
const ANSWER_TIMEOUT_MS = 15_000;

/** What the operator at the terminal is told, and the only output this has. */
export interface ConnectorReport {
  /** A session opened. The version is what it is now serving, or null for none. */
  connected(version: number | null): void;
  /** The channel went. Says why, and when the next attempt is. */
  disconnected(reason: string, retryInMs: number): void;
  /** A newer definition is live and is now the one being served. */
  published(version: number): void;
  /** Something went wrong that the connector carries on through. */
  problem(message: string): void;
}

export interface ConnectorClientOptions {
  /** Where Cloud answers: the API's origin with `ws`/`wss` and `/connector`. */
  url: string;
  token: string;
  engine: ConnectorEngine;
  /** The customer's database. This process is the only one that can reach it. */
  pool: () => Promise<Pool>;
  report: ConnectorReport;
}

/** Why a connector stopped for good. Everything else is retried forever. */
export interface FatalRefusal {
  message: string;
}

/**
 * The connector's whole life on the wire.
 *
 * It dials out and never listens: there is no port to open beside a customer's
 * database, and nothing about this process is reachable from the internet. What
 * it opens is one WebSocket to Cloud, authenticated with the project's own
 * token, over which Cloud sends descriptors and it sends back the DTOs the
 * engine produced — the same engine, the same statements, the same errors as a
 * directly-connected project, one hop further from the database (DECISIONS #064).
 *
 * Losing the channel is ordinary and is treated as such: it backs off, dials
 * again, and re-opens a session — which re-pulls the definition, because a
 * connector that reconnects holding a stale copy would serve the wrong admin.
 * Three things are not ordinary and end the process instead of being retried: a
 * token that no longer stands, a build that speaks a different contract, and
 * another connector taking this project over. Each of them says so out loud,
 * because each is a thing for a human to go and fix rather than wait out.
 */
export class ConnectorClient {
  private readonly session = new ConnectorSession();
  private readonly pending = new Map<number, { answer: (value: Answer) => void; fail: (failure: Error) => void }>();
  private socket?: WebSocket;
  private nextId = 1;
  private retryIn = FIRST_RETRY_MS;
  private heardAt = 0;
  private beat?: NodeJS.Timeout;
  private retry?: NodeJS.Timeout;
  private stopping = false;
  private finish?: (refusal: FatalRefusal | null) => void;

  constructor(private readonly options: ConnectorClientOptions) {}

  /**
   * Runs until something ends it. Resolves with the refusal that did, or with
   * null when `stop` was called — a connector has no other way to finish.
   */
  run(): Promise<FatalRefusal | null> {
    return new Promise<FatalRefusal | null>((resolve) => {
      this.finish = resolve;
      this.dial();
    });
  }

  /** Ends the connector, for the signal that asked it to. */
  stop(): void {
    if (this.stopping) return;
    this.stopping = true;
    this.teardown();
    this.socket?.close(1000, "shutting down");
    this.finish?.(null);
  }

  private dial(): void {
    const socket = new WebSocket(this.options.url, {
      headers: {
        authorization: `Bearer ${this.options.token}`,
        [CONTRACTS_VERSION_HEADER]: CONTRACTS_VERSION,
      },
    });
    this.socket = socket;

    socket.on("open", () => void this.opened());
    socket.on("message", (data) => void this.receive(String(data)));
    socket.on("close", (code, reason) => this.closed(code, String(reason)));
    // Answered by `close`, which follows every one of these. Listening is what
    // stops the failure being thrown where nothing can catch it.
    socket.on("error", () => undefined);
    // A refusal before the handshake: Cloud wrote an error envelope and hung
    // up, which is exactly what it does for a token it will not take and for a
    // build it does not speak.
    socket.on("unexpected-response", (_request, response) => {
      void refusalFrom(response).then((refusal) => this.refuse(refusal));
    });
  }

  /**
   * A session, from its first frame. The definition is pulled before anything
   * is served — including on every reconnect — so the admin this connector
   * answers for is the one that is live right now.
   */
  private async opened(): Promise<void> {
    this.heardAt = Date.now();
    this.beat = setInterval(() => this.pulse(), HEARTBEAT_INTERVAL_MS);

    try {
      const answer = await this.ask({ kind: "openSession" });
      if (answer.kind !== "session") throw new Error("Cloud answered a session with something else");

      this.session.open(answer.actionSecret, answer.definition);
      // A session that opened is a connection that worked, whatever the last
      // few attempts did, so the next failure starts its wait over from short.
      this.retryIn = FIRST_RETRY_MS;
      this.options.report.connected(this.session.current?.version ?? null);
    } catch (failure) {
      this.options.report.problem(messageOf(failure));
      this.socket?.close(1011, "session could not be opened");
    }
  }

  private pulse(): void {
    if (Date.now() - this.heardAt > HEARTBEAT_TIMEOUT_MS) {
      // Nothing has come back for three beats. The socket may believe it is
      // open — a half-open one always does — so it is cut rather than closed,
      // and the reconnect below takes it from there.
      this.socket?.terminate();
      return;
    }
    this.send({ frame: "heartbeat", definitionVersion: this.session.version });
  }

  private async receive(payload: string): Promise<void> {
    this.heardAt = Date.now();

    const frame = read(payload);
    if (!frame) {
      this.options.report.problem("Cloud sent a frame this connector does not recognize.");
      return;
    }

    if (frame.frame === "heartbeat") return;

    if (frame.frame === "answer") {
      const waiting = this.pending.get(frame.id);
      if (!waiting) return;
      this.pending.delete(frame.id);
      if (frame.outcome.ok) waiting.answer(frame.outcome.answer);
      else waiting.fail(new Error(frame.outcome.error.message));
      return;
    }

    if (frame.frame === "notify") return this.resync(frame.notification.version);

    await this.execute(frame.id, frame.definitionVersion, frame.descriptor);
  }

  /** Serves one descriptor, against the definition the request was resolved
   *  against — pulling it first if this connector has not caught up yet. */
  private async execute(
    id: number,
    definitionVersion: number,
    descriptor: Parameters<typeof serve>[1],
  ): Promise<void> {
    if (this.session.version < definitionVersion) await this.pull();

    const current = this.session.current;
    if (!current) {
      this.send({
        frame: "result",
        id,
        outcome: {
          ok: false,
          error: { code: "not_found", message: "This admin has not been published yet" },
        },
        audit: [],
      });
      return;
    }

    const served = await serve(
      {
        engine: this.options.engine,
        definition: current.definition,
        pool: this.options.pool,
        secret: () => Promise.resolve(this.session.secret),
      },
      descriptor,
    );

    this.send({
      frame: "result",
      id,
      outcome: served.ok ? { ok: true, result: served.result } : { ok: false, error: served.error },
      audit: served.audit,
    });
  }

  /** A publish landed. Pulled rather than pushed: the channel is authenticated
   *  in one direction, and asking for it is how this end stays the one asking. */
  private resync(version: number): void {
    void this.pull().then(() => {
      if (this.session.version === version) this.options.report.published(version);
    });
  }

  private async pull(): Promise<void> {
    try {
      const answer = await this.ask({ kind: "pullDefinition" });
      if (answer.kind === "definition") this.session.serve(answer.definition);
    } catch (failure) {
      // A definition that will not validate, or a pull that did not answer.
      // Whatever is being served stays being served: a broken newer definition
      // must not take down an admin that is working.
      this.options.report.problem(
        failure instanceof UnservableDefinition ? failure.message : messageOf(failure),
      );
    }
  }

  /** Asks Cloud something and waits for the answer that carries the same id. */
  private ask(question: Question): Promise<Answer> {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise<Answer>((resolve, reject) => {
      const deadline = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Cloud did not answer in time"));
      }, ANSWER_TIMEOUT_MS);

      this.pending.set(id, {
        answer: (value) => {
          clearTimeout(deadline);
          resolve(value);
        },
        fail: (failure) => {
          clearTimeout(deadline);
          reject(failure);
        },
      });
      this.send({ frame: "ask", id, question });
    });
  }

  private send(frame: ConnectorFrame): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(frame));
  }

  private closed(code: number, reason: string): void {
    this.teardown();
    if (this.stopping) return;

    if (code === REVOKED) {
      return this.refuse({
        message:
          "This project's connector token is no longer valid. Mint a new one on the Connection page and run this again.",
      });
    }
    if (code === REPLACED) {
      return this.refuse({
        message: "Another connector connected for this project, so this one has stood down.",
      });
    }
    if (code === UNSUPPORTED_DATA) {
      return this.refuse({
        message: `RePanel did not recognize a frame from this connector. It speaks contracts ${CONTRACTS_VERSION}; update it and run it again.`,
      });
    }

    this.session.close();
    this.options.report.disconnected(reason === "" ? `closed (${code})` : reason, this.retryIn);
    this.retry = setTimeout(() => this.dial(), this.retryIn);
    this.retry.unref();
    // Doubling, with a little noise, so a Cloud coming back up is not met by
    // every connector in the world at the same instant.
    this.retryIn = Math.min(LONGEST_RETRY_MS, Math.round(this.retryIn * (1.5 + Math.random())));
  }

  /** Ends the connector for a reason that waiting will not fix. */
  private refuse(refusal: FatalRefusal): void {
    if (this.stopping) return;
    this.stopping = true;
    this.teardown();
    this.finish?.(refusal);
  }

  private teardown(): void {
    if (this.beat) clearInterval(this.beat);
    if (this.retry) clearTimeout(this.retry);
    this.beat = undefined;
    this.retry = undefined;

    for (const waiting of this.pending.values()) waiting.fail(new Error("the channel closed"));
    this.pending.clear();
  }
}

/** A frame, or nothing. What arrives is text from a deployment, not from here. */
function read(payload: string): CloudFrame | undefined {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return undefined;
  }

  const parsed = cloudFrameSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * What Cloud said when it refused the handshake. It answers with the same error
 * envelope every other RePanel refusal uses, so the sentence an operator reads
 * at their terminal is the one Cloud wrote — including the two versions, when
 * the two builds do not speak the same contract.
 */
async function refusalFrom(response: { statusCode?: number } & AsyncIterable<Buffer>): Promise<FatalRefusal> {
  const status = response.statusCode ?? 0;

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(chunk);
    const envelope = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ErrorEnvelope;
    if (envelope.error?.message) return { message: envelope.error.message };
  } catch {
    // Nothing readable came back; the status is all there is to go on.
  }

  return { message: `RePanel refused this connector (HTTP ${status}).` };
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}
