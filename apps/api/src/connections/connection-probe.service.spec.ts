import { createServer, type Server, type Socket } from "node:net";
import { ConnectionProbeService } from "./connection-probe.service";

/** How long the probe gives the whole attempt, mirrored from the service. */
const TIMEOUT_MS = 5_000;

const CREDENTIALS = "admin:hunter2";

function dsnFor(port: number): string {
  return `postgres://${CREDENTIALS}@127.0.0.1:${port}/crewbase`;
}

/** A protocol message: its tag, its length counting itself, and its body. */
function message(tag: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeInt32BE(body.length + 4);

  return Buffer.concat([Buffer.from(tag, "ascii"), length, body]);
}

function int32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeInt32BE(value);
  return bytes;
}

/**
 * An ErrorResponse exactly as Postgres sends one: tagged fields, then a
 * terminator. `C` carries the SQLSTATE, which the driver reports back as
 * `error.code` — the only thing the probe classifies on.
 */
function errorResponse(sqlState: string): Buffer {
  const body = `SFATAL\0VFATAL\0C${sqlState}\0Mpassword authentication failed\0\0`;
  return message("E", Buffer.from(body, "utf8"));
}

/** Enough of the protocol for the driver to consider itself connected. */
function handshake(): Buffer {
  return Buffer.concat([
    message("R", int32(0)),
    message("Z", Buffer.from("I", "ascii")),
  ]);
}

describe("ConnectionProbeService", () => {
  const probe = new ConnectionProbeService();
  const servers: Server[] = [];
  const accepted: Socket[] = [];

  afterEach(async () => {
    jest.useRealTimers();
    // A probe that stalled is still holding its socket, and a server with an
    // open socket never finishes closing.
    for (const socket of accepted.splice(0)) socket.destroy();
    await Promise.all(servers.splice(0).map(close));
  });

  /** A listening server on a port of the operating system's choosing. */
  async function listen(answer: (socket: Socket) => void): Promise<number> {
    const server = createServer((socket) => {
      accepted.push(socket);
      answer(socket);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("server has no port");
    return address.port;
  }

  /** A server that answers the startup packet the way a refusal arrives. */
  function refusing(sqlState: string): (socket: Socket) => void {
    return (socket) => socket.once("data", () => socket.write(errorResponse(sqlState)));
  }

  it("calls a port with nothing behind it unreachable", async () => {
    // Taken from the operating system and given straight back, so the test
    // knows nothing else is listening on it.
    const port = await listen(() => undefined);
    const server = servers.pop();
    if (server) await close(server);

    await expect(probe.check(dsnFor(port))).resolves.toEqual({ ok: false, reason: "unreachable" });
  });

  it("calls a refused password an auth failure", async () => {
    const port = await listen(refusing("28P01"));

    await expect(probe.check(dsnFor(port))).resolves.toEqual({ ok: false, reason: "auth_failed" });
  });

  it("calls a rejected connection an auth failure too", async () => {
    // What `pg_hba.conf` answers with when it will not have the caller at all.
    const port = await listen(refusing("28000"));

    await expect(probe.check(dsnFor(port))).resolves.toEqual({ ok: false, reason: "auth_failed" });
  });

  it("gives up on a database that takes the connection and then says nothing", async () => {
    // Only the clock is moved: sockets do their work on ticks and immediates,
    // and a faked one of those would stall the connection rather than time it.
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    const port = await listen(() => undefined);

    const checking = probe.check(dsnFor(port));
    await jest.advanceTimersByTimeAsync(TIMEOUT_MS);

    await expect(checking).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("survives a database that finishes the handshake and then drops the socket", async () => {
    const port = await listen((socket) => {
      socket.once("data", () => {
        socket.write(handshake());
        socket.destroy();
      });
    });

    // A socket that dies with no query in flight is announced on the client
    // itself, where an unlistened-to failure would end the process rather
    // than the probe.
    await expect(probe.check(dsnFor(port))).resolves.toEqual({ ok: false, reason: "unknown" });
  });

  it("says only that it does not know when it has no category for a failure", async () => {
    // A database that is not there is a real answer, and none of the other three.
    const port = await listen(refusing("3D000"));

    await expect(probe.check(dsnFor(port))).resolves.toEqual({ ok: false, reason: "unknown" });
  });

  it("never answers with anything but a category", async () => {
    const port = await listen(refusing("28P01"));

    const result = await probe.check(dsnFor(port));

    // A driver's own words name hosts and users, and repeat some credentials.
    expect(Object.keys(result).sort()).toEqual(["ok", "reason"]);
    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(JSON.stringify(result)).not.toContain("password");
  });
});

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
