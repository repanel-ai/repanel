import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const manifestUrl = new URL("../package.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8")) as { bin: Record<string, string> };

/**
 * pnpm makes the link while it installs, and a fresh clone installs before it
 * builds: a `bin` naming a compiled file is a link pnpm silently skips, and the
 * command is then missing until somebody installs a second time. What is named
 * here has to be in the repository.
 */
test("the command pnpm links is committed, not built", () => {
  const entry = manifest.bin.repanel;

  assert.ok(entry, "the package declares no `repanel` command");
  assert.doesNotMatch(entry, /dist/, "the command points into build output nothing has produced yet");
  assert.equal(existsSync(new URL(entry, manifestUrl)), true, `${entry} is not in the repository`);
});
