import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `repanel dev` reaches nothing but this machine and the customer's own
 * database. That is a promise about a whole command rather than about any one
 * function, so it is checked as one: every module the command runs through is
 * followed from the command itself, and the ways out are counted.
 *
 * It is the command's module graph rather than the package's directory,
 * because the package is no longer only this command: `link` and `deploy` talk
 * to RePanel by design, and a gate that read every file would have to be
 * deleted to let them exist. What it must never lose is the ability to fail,
 * so the closure is asserted to hold what `dev` is made of — and not to hold
 * the client the other two reach RePanel through.
 *
 * The companion to this is `dev-server.test.ts`, which runs the server's whole
 * request cycle with every non-loopback socket refused. This one says the code
 * has no way out; that one says the running server takes none.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_SOURCE = path.join(here, "..");

/**
 * Where the command starts, and the client it serves to the browser. The
 * overlay is a seed of its own because nothing imports it: the server reads it
 * off the disk and sends it, which is a way out of the process if it holds one.
 */
const SEEDS = [path.join("commands", "dev.ts"), path.join("dev", "overlay.client.js")];

/** Where a definition's own `httpCall` goes, which is the one call there is. */
const DECLARED_EGRESS = "@repanel/engine";

/** The only absolute addresses this command may write down. */
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\$\{HOST\})/;

interface Source {
  /** Relative to the package's `src/`, as an import would name it. */
  readonly file: string;
  readonly text: string;
}

/** Every relative specifier a module imports, exports from, or imports later. */
const SPECIFIERS = /(?:\bfrom|\bimport)\s*\(?\s*"(\.[^"]+)"/g;

/**
 * Everything `repanel dev` runs through: the seeds, and everything they reach.
 * A package-relative import is followed; a bare one is a dependency, and the
 * two this package has are gated by the last test in this file.
 */
async function closure(): Promise<Source[]> {
  const reached = new Map<string, Source>();
  const pending = [...SEEDS];

  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (reached.has(file)) continue;

    const text = await readFile(path.join(PACKAGE_SOURCE, file), "utf8");
    reached.set(file, { file, text });

    for (const [, specifier] of text.matchAll(SPECIFIERS)) {
      const resolved = resolve(file, specifier ?? "");
      if (resolved !== undefined) pending.push(resolved);
    }
  }

  return [...reached.values()];
}

/** A specifier as a file in this package: `./spa.js` is `dev/spa.ts` on disk. */
function resolve(from: string, specifier: string): string | undefined {
  if (specifier === "") return undefined;
  const relative = path.join(path.dirname(from), specifier);
  return relative.endsWith(".js") ? `${relative.slice(0, -".js".length)}.ts` : relative;
}

test("the gate follows the command, and reaches everything it is made of", async () => {
  const files = (await closure()).map((source) => source.file);

  // A resolver that quietly found nothing would let every assertion below
  // pass, so what `dev` is made of is named: the command, the assembler it
  // rereads through on every save, the problem reporting, and the server.
  for (const file of [
    "commands/dev.ts",
    "problems.ts",
    "database-url.ts",
    "assemble/assemble.ts",
    "dev/dev-server.ts",
    "dev/spa.ts",
    "dev/api-routes.ts",
    "dev/project.ts",
    "dev/overlay.client.js",
  ]) {
    assert.ok(files.includes(file), `${file} is not gated`);
  }

  // And what it is not made of: the two commands that do reach RePanel, and
  // the client they reach it through. A closure that swallowed those would be
  // a gate that cannot fail.
  for (const file of ["cloud/api.ts", "commands/link.ts", "commands/deploy.ts"]) {
    assert.ok(!files.includes(file), `${file} is inside the gate, which cannot be right`);
  }
});

test("no address outside this machine is written down anywhere in the command", async () => {
  for (const { file, text } of await closure()) {
    for (const [url] of text.matchAll(/https?:\/\/[^\s"'`,)]*/g)) {
      assert.match(url, LOOPBACK, `${file} names an address off this machine: ${url}`);
    }
  }
});

test("nothing here makes an outbound request of its own", async () => {
  for (const { file, text } of await closure()) {
    assert.doesNotMatch(text, /\bfetch\s*\(/, `${file} calls fetch`);
    assert.doesNotMatch(text, /\.request\s*\(/, `${file} opens a request`);
    assert.doesNotMatch(text, /from "node:(https|http2|dgram|dns)"/, `${file} imports a network module`);
  }
});

test("the one module that speaks HTTP does so to listen, not to call", async () => {
  const listeners: string[] = [];

  for (const { file, text } of await closure()) {
    const [importLine] = text.match(/import \{[^}]*\} from "node:http";/) ?? [];
    if (importLine === undefined) continue;
    listeners.push(file);
    assert.match(importLine, /createServer/, `${file} imports node:http for something other than a server`);
    assert.doesNotMatch(importLine, /\brequest\b|\bget\b/, `${file} imports a client from node:http`);
  }

  assert.deepEqual(listeners, [path.join("dev", "dev-server.ts")], "only the server speaks HTTP");
});

test("no RePanel service is named, because none is reached", async () => {
  for (const { file, text } of await closure()) {
    assert.doesNotMatch(text, /API_URL|CONSOLE_URL|repanel\.(app|dev|io|com)/, `${file} names a RePanel service`);
  }
});

test("the entry point reaches RePanel through neither of the two that can", async () => {
  // `bin.ts` and `cli.ts` import every command, `link` and `deploy` included,
  // so they are outside the closure — but they run whatever was typed, and
  // what they must not do is call out on their own behalf.
  for (const file of ["bin.ts", "cli.ts"]) {
    const text = await readFile(path.join(PACKAGE_SOURCE, file), "utf8");
    assert.doesNotMatch(text, /\bfetch\s*\(/, `${file} calls fetch`);
    assert.doesNotMatch(text, /from "node:(http|https|http2|dgram|dns)"/, `${file} speaks HTTP`);
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
