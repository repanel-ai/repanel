import type { Answer, CloudFrame, Descriptor, Question } from "@repanel/contracts";
import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import { ConnectorOfflineError, ConnectorTimeoutError } from "../errors/domain-errors";
import { ConnectorChannel } from "./connector-channel";

const PROJECT = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const LIST: Descriptor = { kind: "listRecords", resourceKey: "users", query: { page: 1, pageSize: 25 } };

/** A socket that records what was written to it and can be made to go away. */
class FakeSocket extends EventEmitter {
  readonly sent: CloudFrame[] = [];
  closedWith?: { code: number; reason: string };

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as CloudFrame);
  }

  close(code: number, reason: string): void {
    this.closedWith = { code, reason };
    this.emit("close");
  }

  /** What the far end says back. */
  reply(frame: unknown): void {
    this.emit("message", JSON.stringify(frame));
  }
}

function channelOn(
  socket: FakeSocket,
  answer: (projectId: string, question: Question) => Promise<Answer> = () =>
    Promise.reject(new Error("nothing answers questions here")),
): { channel: ConnectorChannel; problems: string[] } {
  const problems: string[] = [];
  const channel = new ConnectorChannel(PROJECT, socket as unknown as WebSocket, answer, (_project, problem) =>
    problems.push(problem),
  );
  return { channel, problems };
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("ConnectorChannel", () => {
  it("sends a descriptor and answers with what came back under the same id", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);

    const served = channel.execute(3, LIST, 1_000);
    const sent = socket.sent[0];
    expect(sent).toMatchObject({ frame: "execute", definitionVersion: 3, descriptor: LIST });

    socket.reply({
      frame: "result",
      id: sent?.frame === "execute" ? sent.id : 0,
      outcome: { ok: true, result: { records: [], total: 0, page: 1, pageSize: 25 } },
      audit: [],
    });

    await expect(served).resolves.toMatchObject({ outcome: { ok: true } });
  });

  it("keeps two requests apart, whichever order they are answered in", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);

    const first = channel.execute(1, LIST, 1_000);
    const second = channel.execute(1, { kind: "getRecord", resourceKey: "users", id: "u1" }, 1_000);
    const ids = socket.sent.map((frame) => (frame.frame === "execute" ? frame.id : 0));

    socket.reply({ frame: "result", id: ids[1], outcome: { ok: true, result: "second" }, audit: [] });
    socket.reply({ frame: "result", id: ids[0], outcome: { ok: true, result: "first" }, audit: [] });

    await expect(first).resolves.toMatchObject({ outcome: { result: "first" } });
    await expect(second).resolves.toMatchObject({ outcome: { result: "second" } });
  });

  it("brings a refusal back with the audit the far end filed alongside it", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);

    const served = channel.execute(1, LIST, 1_000);
    const id = socket.sent[0]?.frame === "execute" ? socket.sent[0].id : 0;
    socket.reply({
      frame: "result",
      id,
      outcome: { ok: false, error: { code: "not_found", message: "Record not found" } },
      audit: [
        {
          kind: "update",
          resourceKey: "users",
          recordId: "u1",
          actionKey: null,
          outcome: "refused",
          reason: "not_found",
          before: null,
          after: null,
        },
      ],
    });

    await expect(served).resolves.toMatchObject({
      outcome: { ok: false, error: { code: "not_found" } },
      audit: [{ outcome: "refused" }],
    });
  });

  it("gives up on a request the far end does not answer in time", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);

    const refusal = await refusalFrom(channel.execute(1, LIST, 10));

    expect(refusal).toBeInstanceOf(ConnectorTimeoutError);
    // Told apart from a slow query on purpose: the hop said nothing.
    expect(refusal.message).toContain("did not answer in time");
  });

  it("fails everything still waiting when the channel goes, rather than leaving it", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);

    const waiting = channel.execute(1, LIST, 60_000);
    socket.emit("close");

    expect(await refusalFrom(waiting)).toBeInstanceOf(ConnectorOfflineError);
  });

  it("refuses a request made after the channel has gone, without sending anything", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);
    socket.emit("close");

    expect(await refusalFrom(channel.execute(1, LIST, 60_000))).toBeInstanceOf(ConnectorOfflineError);
    expect(socket.sent).toEqual([]);
  });

  it("ignores an answer that arrives after its own deadline", async () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);

    await refusalFrom(channel.execute(1, LIST, 10));
    const id = socket.sent[0]?.frame === "execute" ? socket.sent[0].id : 0;

    // Nobody is waiting on it, and nothing here may throw where it cannot be caught.
    expect(() => socket.reply({ frame: "result", id, outcome: { ok: true, result: 1 }, audit: [] })).not.toThrow();
  });

  it("answers a heartbeat, so silence is detectable from the far end too", () => {
    const socket = new FakeSocket();
    const { channel } = channelOn(socket);
    const before = channel.lastSeenAt.getTime();

    socket.reply({ frame: "heartbeat", definitionVersion: 7 });

    expect(socket.sent).toEqual([{ frame: "heartbeat" }]);
    expect(channel.definitionVersion).toBe(7);
    expect(channel.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("answers a question through whoever knows what it means", async () => {
    const socket = new FakeSocket();
    channelOn(socket, (_projectId, question) =>
      Promise.resolve(
        question.kind === "openSession"
          ? { kind: "session", actionSecret: "s3cret", definition: null }
          : { kind: "definition", definition: null },
      ),
    );

    socket.reply({ frame: "ask", id: 5, question: { kind: "openSession" } });
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.sent).toEqual([
      {
        frame: "answer",
        id: 5,
        outcome: { ok: true, answer: { kind: "session", actionSecret: "s3cret", definition: null } },
      },
    ]);
  });

  it("tells the far end why a question could not be answered", async () => {
    const socket = new FakeSocket();
    channelOn(socket, () => Promise.reject(new ConnectorOfflineError("nothing to say")));

    socket.reply({ frame: "ask", id: 6, question: { kind: "pullDefinition" } });
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.sent).toEqual([
      {
        frame: "answer",
        id: 6,
        outcome: { ok: false, error: { code: "connector_offline", message: "nothing to say" } },
      },
    ]);
  });

  it("closes on a frame this protocol does not contain, and says which project", () => {
    const socket = new FakeSocket();
    const { problems } = channelOn(socket);

    socket.reply({ frame: "runSql", text: "select 1" });

    expect(socket.closedWith).toEqual({ code: 1003, reason: "unrecognized frame" });
    expect(problems).toEqual(["sent a frame this protocol does not contain"]);
  });

  it("closes on text that is not a frame at all", () => {
    const socket = new FakeSocket();
    channelOn(socket);

    socket.emit("message", "not json");

    expect(socket.closedWith).toEqual({ code: 1003, reason: "unrecognized frame" });
  });
});
