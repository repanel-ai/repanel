import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * The connector writes nothing to disk, and this is what holds it to that.
 *
 * It is a property worth a gate rather than a promise. The connector holds the
 * three things RePanel's hosted side deliberately does not — the connection
 * string, the published definition, and the project's signing secret — and the
 * reason it is safe to hand it those is that stopping the process ends them.
 * A cache file, a log of what was served, a "remember the last definition"
 * convenience: any one of them turns a stateless process into a thing with
 * secrets at rest, and none of them would announce itself (DECISIONS #064).
 *
 * Reading is not what this forbids. The connection string is read from the
 * environment the operator started it in, and `database-url.ts` is in the scan
 * for exactly that reason: it reads, and it must go on only reading.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Every file the connector is: its own, its command, and what those reach for. */
async function connectorSources(): Promise<Array<[string, string]>> {
  const own = (await readdir(HERE))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(HERE, file));

  const reached = [
    path.join(HERE, "..", "commands", "connect.ts"),
    path.join(HERE, "..", "database-url.ts"),
  ];

  return Promise.all(
    [...own, ...reached].map(
      async (file) => [path.basename(file), await readFile(file, "utf8")] as [string, string],
    ),
  );
}

/**
 * Every way this runtime writes a file. Named one by one rather than matched by
 * a pattern: a list somebody has to add to is a list somebody has to think
 * about.
 */
const WRITES = [
  "writeFile",
  "appendFile",
  "createWriteStream",
  "mkdir",
  "mkdtemp",
  "unlink",
  "rmdir",
  "copyFile",
  "rename",
  "truncate",
  "chmod",
  "writeFileSync",
  "openSync",
  "localStorage",
];

function writesIn(source: string): string[] {
  return WRITES.filter((call) => new RegExp(`\\b${call}\\s*\\(`).test(source));
}

test("nothing the connector is made of writes to disk", async () => {
  const offending = (await connectorSources()).flatMap(([file, source]) =>
    writesIn(source).map((call) => `${file}: ${call}`),
  );

  assert.deepEqual(offending, []);
});

test("the connector's own files reach for no filesystem at all", async () => {
  const own = (await connectorSources()).filter(([file]) =>
    ["client.ts", "dispatch.ts", "session.ts"].includes(file),
  );

  assert.equal(own.length, 3);
  for (const [file, source] of own) {
    assert.ok(!/from "node:fs/.test(source), `${file} imports a filesystem`);
  }
});

test("the gate would notice one, which is the only reason the two above are worth anything", () => {
  const cached = 'await writeFile(cache, JSON.stringify(definition));';

  assert.deepEqual(writesIn(cached), ["writeFile"]);
});
