import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer, type Server } from "node:http";
import type { Duplex } from "node:stream";
import {
  CONTRACTS_VERSION,
  connectorFrameSchema,
  validateDefinition,
  type ConnectorFrame,
  type ErrorEnvelope,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { ActionRunner, RecordReader, RecordWriter } from "@repanel/engine";
import type { Pool } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import { ConnectorClient, type ConnectorReport } from "./client.js";
import type { ConnectorEngine } from "./dispatch.js";

/** One connector that has arrived, and what was said to it. */
interface Arrival {
  socket: WebSocket;
  headers: Record<string, string | string[] | undefined>;
  frames: ConnectorFrame[];
}

/**
 * Cloud, in as much of it as a connector can tell apart: the upgrade, the
 * refusals it writes before the handshake, and the frames it answers with.
 */
class FakeCloud {
  private readonly http = createServer();
  private readonly sockets = new WebSocketServer({ noServer: true });
  readonly arrivals: Arrival[] = [];
  /** What to refuse the next upgrade with, if it is to be refused. */
  refusal?: { status: number; code: string; message: string };

  async start(): Promise<void> {
    this.http.on("upgrade", (request, socket, head) => {
      if (this.refusal) return refuse(socket as Duplex, this.refusal);

      this.sockets.handleUpgrade(request, socket as Duplex, head, (connection) => {
        const arrival: Arrival = { socket: connection, headers: request.headers, frames: [] };
        this.arrivals.push(arrival);
        connection.on("error", () => undefined);
        connection.on("message", (data) => {
          const parsed = connectorFrameSchema.safeParse(JSON.parse(String(data)) as unknown);
          if (parsed.success) arrival.frames.push(parsed.data);
          this.answer(connection, parsed.success ? parsed.data : undefined);
        });
      });
    });

    await new Promise<void>((resolve) => this.http.listen(0, "127.0.0.1", resolve));
  }

  get url(): string {
    const address = this.http.address();
    if (typeof address !== "object" || address === null) throw new Error("not listening");
    return `ws://127.0.0.1:${address.port}/connector`;
  }

  /** The connector holding the newest channel, once one has arrived. */
  async newest(): Promise<Arrival> {
    for (let waited = 0; waited < 200; waited += 1) {
      const arrival = this.arrivals.at(-1);
      if (arrival) return arrival;
      await pause(25);
    }
    throw new Error("no connector arrived");
  }

  send(arrival: Arrival, frame: unknown): void {
    arrival.socket.send(JSON.stringify(frame));
  }

  async stop(): Promise<void> {
    for (const arrival of this.arrivals) arrival.socket.terminate();
    this.sockets.close();
    this.http.closeAllConnections();
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  /** The two questions, answered the way the API answers them. */
  private answer(socket: WebSocket, frame: ConnectorFrame | undefined): void {
    if (!frame) return;
    if (frame.frame === "heartbeat") return socket.send(JSON.stringify({ frame: "heartbeat" }));
    if (frame.frame !== "ask") return;

    const definition = { version: 1, payload: saasDefinition };
    const answer =
      frame.question.kind === "openSession"
        ? { kind: "session", actionSecret: "s3cret", definition }
        : { kind: "definition", definition };

    socket.send(JSON.stringify({ frame: "answer", id: frame.id, outcome: { ok: true, answer } }));
  }
}

/** Cloud's refusal before the handshake, written exactly as the API writes it. */
function refuse(socket: Duplex, { status, code, message }: { status: number; code: string; message: string }): void {
  const envelope: ErrorEnvelope = { error: { code, message } };
  const body = JSON.stringify(envelope);
  socket.write(
    `HTTP/1.1 ${status} Refused\r\ncontent-type: application/json\r\n` +
      `content-length: ${Buffer.byteLength(body)}\r\nconnection: close\r\n\r\n${body}`,
  );
  socket.destroy();
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Everything the connector said, so a test can wait for one of the lines. */
function reporting(): { report: ConnectorReport; said: string[] } {
  const said: string[] = [];
  return {
    said,
    report: {
      connected: (version) => said.push(`connected:${version ?? "nothing"}`),
      published: (version) => said.push(`published:${version}`),
      disconnected: (reason) => said.push(`disconnected:${reason}`),
      problem: (message) => said.push(`problem:${message}`),
    },
  };
}

/** Waits for a line, and fails rather than hanging when it does not come. */
async function until(said: string[], line: string, budgetMs = 6_000): Promise<void> {
  for (let waited = 0; waited < budgetMs; waited += 25) {
    if (said.includes(line)) return;
    await pause(25);
  }
  throw new Error(`never said ${line}; said ${JSON.stringify(said)}`);
}

const engine: ConnectorEngine = {
  reader: {
    listRecords: () => Promise.resolve({ records: [], total: 0, page: 1, pageSize: 25 }),
  } as unknown as RecordReader,
  writer: {} as unknown as RecordWriter,
  runner: {} as unknown as ActionRunner,
};

const clients: ConnectorClient[] = [];
const clouds: FakeCloud[] = [];

async function connected(cloud: FakeCloud, token = "rpc_" + "a".repeat(40)) {
  const { report, said } = reporting();
  const client = new ConnectorClient({
    url: cloud.url,
    token,
    engine,
    pool: () => Promise.reject(new Error("no database in this test")) as Promise<Pool>,
    report,
  });
  clients.push(client);
  const finished = client.run();
  return { client, said, finished };
}

async function cloudUp(): Promise<FakeCloud> {
  const cloud = new FakeCloud();
  clouds.push(cloud);
  await cloud.start();
  return cloud;
}

after(async () => {
  for (const client of clients) client.stop();
  for (const cloud of clouds) await cloud.stop();
});

test("dials out carrying the project's token and the contract it speaks", async () => {
  const cloud = await cloudUp();
  const { said } = await connected(cloud);
  await until(said, "connected:1");

  const arrival = await cloud.newest();
  assert.equal(arrival.headers.authorization, `Bearer rpc_${"a".repeat(40)}`);
  assert.equal(arrival.headers["x-repanel-contracts-version"], CONTRACTS_VERSION);
});

test("opens its session by asking for the definition, before it serves anything", async () => {
  const cloud = await cloudUp();
  const { said } = await connected(cloud);
  await until(said, "connected:1");

  const arrival = await cloud.newest();
  assert.deepEqual(arrival.frames[0], { frame: "ask", id: 1, question: { kind: "openSession" } });
});

test("serves a descriptor with the engine and answers under the id it came with", async () => {
  const cloud = await cloudUp();
  const { said } = await connected(cloud);
  await until(said, "connected:1");
  const arrival = await cloud.newest();

  cloud.send(arrival, {
    frame: "execute",
    id: 41,
    definitionVersion: 1,
    descriptor: { kind: "listRecords", resourceKey: "users", query: { page: 1, pageSize: 25 } },
  });

  for (let waited = 0; waited < 200; waited += 1) {
    const result = arrival.frames.find((frame) => frame.frame === "result");
    if (result) {
      assert.deepEqual(result, {
        frame: "result",
        id: 41,
        outcome: { ok: true, result: { records: [], total: 0, page: 1, pageSize: 25 } },
        audit: [],
      });
      return;
    }
    await pause(25);
  }
  throw new Error("nothing came back");
});

test("pulls the definition again when a publish is announced", async () => {
  const cloud = await cloudUp();
  const { said } = await connected(cloud);
  await until(said, "connected:1");
  const arrival = await cloud.newest();

  cloud.send(arrival, { frame: "notify", notification: { kind: "definitionPublished", version: 1 } });

  await until(said, "published:1");
  assert.ok(
    arrival.frames.some(
      (frame) => frame.frame === "ask" && frame.question.kind === "pullDefinition",
    ),
  );
});

test("reconnects after the channel goes, and opens a session again rather than assuming one", async () => {
  const cloud = await cloudUp();
  const { said } = await connected(cloud);
  await until(said, "connected:1");

  (await cloud.newest()).socket.terminate();

  // The second `connected` line is the proof: a reconnect re-opens the session,
  // which is what re-pulls the definition.
  for (let waited = 0; waited < 8_000; waited += 50) {
    if (said.filter((line) => line === "connected:1").length === 2) {
      assert.equal(cloud.arrivals.length, 2);
      return;
    }
    await pause(50);
  }
  throw new Error(`never reconnected; said ${JSON.stringify(said)}`);
});

test("stops for good on a contract this deployment does not speak, and says which two", async () => {
  const cloud = await cloudUp();
  cloud.refusal = {
    status: 426,
    code: "connector_version_mismatch",
    message: `This connector was built against RePanel contracts 0.0.1, and this deployment speaks ${CONTRACTS_VERSION}.`,
  };

  const { finished } = await connected(cloud);
  const refusal = await finished;

  assert.ok(refusal?.message.includes("0.0.1"));
  assert.ok(refusal?.message.includes(CONTRACTS_VERSION));
});

test("stops for good on a token this project does not accept, without retrying it", async () => {
  const cloud = await cloudUp();
  cloud.refusal = { status: 401, code: "unauthorized", message: "Connector token is invalid" };

  const { finished } = await connected(cloud, "rpc_" + "b".repeat(40));

  assert.deepEqual(await finished, { message: "Connector token is invalid" });
  assert.equal(cloud.arrivals.length, 0);
});

test("stands down when its token is revoked, and says where a new one comes from", async () => {
  const cloud = await cloudUp();
  const { said, finished } = await connected(cloud);
  await until(said, "connected:1");

  (await cloud.newest()).socket.close(4001, "token revoked");

  const refusal = await finished;
  assert.ok(refusal?.message.includes("Connection page"));
});

test("stands down when another connector takes the project over", async () => {
  const cloud = await cloudUp();
  const { said, finished } = await connected(cloud);
  await until(said, "connected:1");

  (await cloud.newest()).socket.close(4002, "another connector connected for this project");

  const refusal = await finished;
  assert.ok(refusal?.message.includes("Another connector"));
});

test("ends with nothing left running when it is stopped", async () => {
  const cloud = await cloudUp();
  const { client, said, finished } = await connected(cloud);
  await until(said, "connected:1");

  client.stop();

  assert.equal(await finished, null);
});
