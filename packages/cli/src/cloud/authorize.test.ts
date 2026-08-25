import assert from "node:assert/strict";
import { test } from "node:test";
import type { Terminal } from "../terminal.js";
import { authorize } from "./authorize.js";

const CONSOLE = "http://127.0.0.1:5173";

/**
 * A browser that does what the console does: reads the port and the nonce out
 * of the address it was sent to, and comes back to that port with a token.
 */
function browser(answer: (opened: URL) => Promise<void>): Terminal & { written: string[] } {
  const written: string[] = [];
  return {
    written,
    write: (line) => void written.push(line),
    browse: (url) => void answer(new URL(url)).catch(() => undefined),
  };
}

/** The callback the console would build out of what the CLI sent it. */
function callback(opened: URL, state = opened.searchParams.get("state") ?? ""): URL {
  const url = new URL(`http://127.0.0.1:${opened.searchParams.get("port")}/`);
  url.searchParams.set("state", state);
  url.searchParams.set("token", "cli-token");
  return url;
}

test("the console is sent a port to answer on, and answers it with a session", async () => {
  const terminal = browser(async (opened) => void (await fetch(callback(opened))));

  assert.equal(await authorize(CONSOLE, terminal), "cli-token");
});

test("the address the browser is sent to is the console's, and carries no secret", async () => {
  let opened: URL | undefined;
  const terminal = browser(async (url) => {
    opened = url;
    await fetch(callback(url));
  });

  await authorize(CONSOLE, terminal);

  assert.equal(opened?.origin, CONSOLE);
  assert.equal(opened?.pathname, "/cli");
  assert.deepEqual([...(opened?.searchParams.keys() ?? [])].sort(), ["port", "state"]);
  // Printed as well as opened: a browser that will not open is not a dead end.
  assert.ok(terminal.written.some((line) => line.includes(opened?.toString() ?? "")));
});

test("a callback that does not carry this run's nonce is refused, and the wait goes on", async () => {
  let refused = 0;
  const terminal = browser(async (opened) => {
    // Any page in that browser can navigate to a loopback port. This is one,
    // and it must not be able to end the wait or be handed anything.
    refused = (await fetch(callback(opened, "guessed"))).status;
    await fetch(callback(opened));
  });

  const token = await authorize(CONSOLE, terminal);

  assert.equal(refused, 400);
  assert.equal(token, "cli-token");
});

test("a callback carrying no token is refused, whatever else it carries", async () => {
  let refused = 0;
  const terminal = browser(async (opened) => {
    const empty = callback(opened);
    empty.searchParams.delete("token");
    refused = (await fetch(empty)).status;
    await fetch(callback(opened));
  });

  await authorize(CONSOLE, terminal);

  assert.equal(refused, 400);
});
