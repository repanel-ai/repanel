import assert from "node:assert/strict";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { denyEgress } from "./dev.test-helpers.js";

/**
 * The guard the zero-egress proof rests on, checked against every shape a
 * connection actually arrives in.
 *
 * This exists because the first version of it read only `socket.connect(options)`
 * — the one shape no client library produces. `net.connect(...)`, and therefore
 * `fetch`, `http.request` and `pg`, normalize their arguments into a single
 * `[options, callback]` array first, so every plain-HTTP request went straight
 * through a guard that reported nothing. A proof that cannot fail proves
 * nothing, so the ways it must fail are written down here.
 */

/** Reserved for documentation (RFC 5737); nothing is listening and nothing should try. */
const ELSEWHERE = "192.0.2.1";

let restore: () => void;

before(() => {
  restore = denyEgress();
});

after(() => {
  restore();
});

async function denied(attempt: () => unknown): Promise<string> {
  try {
    await attempt();
  } catch (error) {
    return String(error instanceof Error ? (error.cause ?? error) : error);
  }
  return "reached";
}

test("a plain-HTTP request off this machine is refused", async () => {
  const said = await denied(() => fetch(`http://${ELSEWHERE}/`, { signal: AbortSignal.timeout(500) }));

  assert.match(said, /egress denied/, "fetch normalizes into net.connect, and that must be seen");
});

test("an HTTPS request off this machine is refused", async () => {
  const said = await denied(() => fetch(`https://${ELSEWHERE}/`, { signal: AbortSignal.timeout(500) }));

  assert.match(said, /egress denied/);
});

test("every shape `connect` is called in is read", async () => {
  for (const [shape, attempt] of [
    ["net.connect(options)", () => net.connect({ host: ELSEWHERE, port: 80 })],
    ["net.connect(port, host)", () => net.connect(80, ELSEWHERE)],
    ["socket.connect(options)", () => new net.Socket().connect({ host: ELSEWHERE, port: 80 })],
  ] as const) {
    assert.match(await denied(attempt), /egress denied/, `${shape} was not seen`);
  }
});

test("a connection this guard cannot read is refused, not waved through", async () => {
  const said = await denied(() =>
    (new net.Socket().connect as unknown as (...args: unknown[]) => unknown)("not a shape we know"),
  );

  assert.match(said, /egress denied/);
});

test("this machine is still reachable, or nothing above could have run", async () => {
  const server = net.createServer().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));

  try {
    const port = (server.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", reject);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
