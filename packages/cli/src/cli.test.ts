import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "./cli.js";

const anywhere = process.cwd();

test("with no command, the help lists every command", async () => {
  const result = await run([], anywhere);

  assert.equal(result.exitCode, 0);
  const help = result.lines.join("\n");
  for (const command of ["validate", "dev", "link", "deploy"]) assert.match(help, new RegExp(command));
});

test("a command's own help is its usage", async () => {
  const result = await run(["validate", "--help"], anywhere);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), /repanel validate/);
});

test("the commands still to come say so, and do not report success", async () => {
  const result = await run(["dev"], anywhere);

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /`repanel dev` is not implemented yet/);
});

test("an unknown command is a usage error", async () => {
  const result = await run(["validaet"], anywhere);

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /Unknown command `validaet`/);
});

test("an unknown option is refused rather than ignored", async () => {
  const result = await run(["validate", "--fix"], anywhere);

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /--fix/);
});

test("a command that takes no arguments says so", async () => {
  const result = await run(["validate", "./somewhere"], anywhere);

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /takes no arguments/);
});
