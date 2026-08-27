import {
  connectorFrameSchema,
  type Answer,
  type CloudFrame,
  type Descriptor,
  type FrameAuditEvent,
  type FrameError,
  type Notification,
  type Question,
} from "@repanel/contracts";
import type { WebSocket } from "ws";
import { ConnectorOfflineError, ConnectorTimeoutError } from "../errors/domain-errors";

/** What a connector came back with: the engine's answer, and its account of it. */
export interface ConnectorResult {
  outcome: { ok: true; result: unknown } | { ok: false; error: FrameError };
  /** The events the engine filed while doing it. Empty for a read. */
  audit: readonly FrameAuditEvent[];
}

/** What a caller is owed, and how long it may wait for it. */
interface Pending {
  settle: (result: ConnectorResult) => void;
  fail: (failure: Error) => void;
  deadline: NodeJS.Timeout;
}

/** Answers a connector's own questions. Supplied by whoever knows what they mean. */
export type Answerer = (projectId: string, question: Question) => Promise<Answer>;

/** A connector sent something this protocol does not contain. */
const UNSUPPORTED_DATA = 1003;

/**
 * One connector, for as long as it is there.
 *
 * It holds the socket, the requests waiting on it, and the last time the far
 * end said anything — and it knows nothing about what a descriptor means. That
 * separation is what lets the definitions feature announce a publish through
 * here without depending on the feature that serves one.
 *
 * Every request in flight is settled exactly once: by an answer, by its own
 * deadline, or by the socket going away. Nothing is left waiting on a channel
 * that has closed, which is the difference between an admin that says "the
 * connector is offline" and one that hangs (DECISIONS #064).
 */
export class ConnectorChannel {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private seenAt = new Date();
  private version = 0;
  private closed = false;

  constructor(
    readonly projectId: string,
    private readonly socket: WebSocket,
    private readonly answer: Answerer,
    private readonly onProtocolFailure: (projectId: string, message: string) => void,
  ) {
    socket.on("message", (data) => void this.receive(String(data)));
    socket.on("close", () => this.abandon());
    // A socket that dies with nothing in flight announces itself here, and an
    // emitter with no `error` listener throws where nothing can catch it.
    socket.on("error", () => this.abandon());
  }

  /** When the far end last said anything. What the console's "last seen" reads. */
  get lastSeenAt(): Date {
    return this.seenAt;
  }

  /** The published version this connector says it is serving; 0 before it says. */
  get definitionVersion(): number {
    return this.version;
  }

  /**
   * Asks the connector to serve one request, and waits no longer than it was
   * told to. The deadline is the caller's, because how long is reasonable
   * depends on what was asked — a call out to a customer's application is
   * allowed to take longer than a select.
   */
  execute(definitionVersion: number, descriptor: Descriptor, timeoutMs: number): Promise<ConnectorResult> {
    if (this.closed) return Promise.reject(offline());

    const id = this.nextId;
    this.nextId += 1;

    return new Promise<ConnectorResult>((resolve, reject) => {
      const deadline = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new ConnectorTimeoutError(
            "The connector for this project did not answer in time. The database was not the hold-up.",
          ),
        );
      }, timeoutMs);

      this.pending.set(id, { settle: resolve, fail: reject, deadline });
      this.send({ frame: "execute", id, definitionVersion, descriptor });
    });
  }

  /** Tells the connector something without waiting to hear back. */
  notify(notification: Notification): void {
    this.send({ frame: "notify", notification });
  }

  /** Ends the channel. Everything waiting on it is told, rather than left. */
  close(code: number, reason: string): void {
    this.socket.close(code, reason);
    this.abandon();
  }

  private send(frame: CloudFrame): void {
    if (this.closed) return;
    this.socket.send(JSON.stringify(frame));
  }

  private async receive(payload: string): Promise<void> {
    const frame = read(payload);
    if (!frame) {
      // A frame this protocol does not contain is a build that disagrees with
      // ours about what the protocol is, and there is nothing to negotiate.
      this.onProtocolFailure(this.projectId, "sent a frame this protocol does not contain");
      this.close(UNSUPPORTED_DATA, "unrecognized frame");
      return;
    }

    this.seenAt = new Date();

    if (frame.frame === "heartbeat") {
      this.version = frame.definitionVersion;
      // Answered, so that silence is detectable from the connector's end too:
      // a half-open socket is invisible to whichever side is only listening.
      this.send({ frame: "heartbeat" });
      return;
    }

    if (frame.frame === "result") {
      const waiting = this.pending.get(frame.id);
      // An id nobody is waiting on is an answer that arrived after its own
      // deadline. The caller has already been told; there is nothing to do.
      if (!waiting) return;
      this.pending.delete(frame.id);
      clearTimeout(waiting.deadline);
      waiting.settle({ outcome: frame.outcome, audit: frame.audit });
      return;
    }

    await this.respond(frame.id, frame.question);
  }

  /** Answers one of the connector's own questions, or says why it cannot. */
  private async respond(id: number, question: Question): Promise<void> {
    try {
      const answer = await this.answer(this.projectId, question);
      this.send({ frame: "answer", id, outcome: { ok: true, answer } });
    } catch (failure) {
      this.send({
        frame: "answer",
        id,
        outcome: {
          ok: false,
          error: {
            code: codeOf(failure),
            message: failure instanceof Error ? failure.message : "The question could not be answered",
          },
        },
      });
    }
  }

  /**
   * The channel is gone. Every request still waiting on it fails as one that
   * never reached anything — which is what it is, and is the whole reason a
   * connector being killed does not leave an operator's screen spinning.
   */
  private abandon(): void {
    if (this.closed) return;
    this.closed = true;

    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.deadline);
      waiting.fail(offline());
    }
    this.pending.clear();
  }
}

function offline(): ConnectorOfflineError {
  return new ConnectorOfflineError(
    "The connector for this project is not connected, so nothing was asked of its database.",
  );
}

/** A frame, or nothing. What arrives is text from another build entirely. */
function read(payload: string): ReturnType<typeof connectorFrameSchema.safeParse>["data"] {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return undefined;
  }

  const parsed = connectorFrameSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function codeOf(failure: unknown): string {
  const code = (failure as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : "internal_error";
}
