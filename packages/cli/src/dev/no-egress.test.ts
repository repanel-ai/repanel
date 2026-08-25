import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `repanel dev` reaches nothing but this machine and the customer's own
 * database. That is a promise about a whole directory rather than about any
 * one function, so it is checked as one: the source is read and the ways out
 * are counted.
 *
 * The companion to this is `dev-server.test.ts`, which runs the server's whole
 * request cycle with every non-loopback socket refused. This one says the code
 * has no way out; that one says the running server takes none.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Every file `repanel dev` runs through, not only the server's own. */
const PACKAGE_SOURCE = path.join(here, "..");

/** Where a definition's own `httpCall` goes, which is the one call there is. */
const DECLARED_EGRESS = "@repanel/engine";

/** The only absolute addresses this command may write down. */
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\$\{HOST\})/;

async function sources(): Promise<Array<{ file: string; text: string }>> {
  const files = await walk(PACKAGE_SOURCE);
  return Promise.all(
    files.map(async (file) => ({
      file: path.relative(PACKAGE_SOURCE, file),
      text: await readFile(file, "utf8"),
    })),
  );
}

/** Every source file of the package, tests and their helpers aside. */
async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test-helpers.ts")) continue;
    files.push(full);
  }

  return files;
}

test("no address outside this machine is written down anywhere in the command", async () => {
  for (const { file, text } of await sources()) {
    for (const [url] of text.matchAll(/https?:\/\/[^\s"'`,)]*/g)) {
      assert.match(url, LOOPBACK, `${file} names an address off this machine: ${url}`);
    }
  }
});

test("nothing here makes an outbound request of its own", async () => {
  for (const { file, text } of await sources()) {
    assert.doesNotMatch(text, /\bfetch\s*\(/, `${file} calls fetch`);
    assert.doesNotMatch(text, /\.request\s*\(/, `${file} opens a request`);
    assert.doesNotMatch(text, /from "node:(https|http2|dgram|dns)"/, `${file} imports a network module`);
  }
});

test("the gate reads the whole package, not only the server", async () => {
  const files = (await sources()).map(({ file }) => file);

  // Everything `dev` touches: the entry point, the dispatcher, the assembler it
  // rereads through on every save, and the server itself.
  for (const file of ["bin.ts", "cli.ts", "problems.ts", "commands/dev.ts", "assemble/assemble.ts", "dev/dev-server.ts"]) {
    assert.ok(files.includes(file), `${file} is not gated`);
  }
});

test("the one module that speaks HTTP does so to listen, not to call", async () => {
  const listeners: string[] = [];

  for (const { file, text } of await sources()) {
    const [importLine] = text.match(/import \{[^}]*\} from "node:http";/) ?? [];
    if (importLine === undefined) continue;
    listeners.push(file);
    assert.match(importLine, /createServer/, `${file} imports node:http for something other than a server`);
    assert.doesNotMatch(importLine, /\brequest\b|\bget\b/, `${file} imports a client from node:http`);
  }

  assert.deepEqual(listeners, [path.join("dev", "dev-server.ts")], "only the server speaks HTTP");
});

test("no RePanel service is named, because none is reached", async () => {
  for (const { file, text } of await sources()) {
    assert.doesNotMatch(text, /API_URL|CONSOLE_URL|repanel\.(app|dev|io|com)/, `${file} names a RePanel service`);
  }
});

test("the only call out of the process is the one a definition declares", async () => {
  const runner = await readFile(path.join(PACKAGE_SOURCE, "commands/dev.ts"), "utf8");

  // `HttpCall` is the engine's, it is signed, and it goes to the URL an
  // `httpCall` action names — the customer's own application. Nothing in this
  // command constructs any other client.
  assert.match(runner, new RegExp(`from "${DECLARED_EGRESS}"`));
  assert.match(runner, /new HttpCall\(\)/);
});
