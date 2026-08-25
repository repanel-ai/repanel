import assert from "node:assert/strict";
import { test } from "node:test";
import { run, type CliContext } from "./cli.js";

const anywhere = process.cwd();

/** A terminal nobody is at: whatever a command writes is collected, not printed. */
function context(): CliContext & { written: string[] } {
  const written: string[] = [];
  return { written, env: {}, io: { write: (line) => void written.push(line) } };
}

test("with no command, the help lists every command", async () => {
  const result = await run([], anywhere, context());

  assert.equal(result.exitCode, 0);
  const help = result.lines.join("\n");
  for (const command of ["validate", "dev", "link", "deploy"]) assert.match(help, new RegExp(command));
});

test("a command's own help is its usage", async () => {
  const result = await run(["validate", "--help"], anywhere, context());

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), /repanel validate/);
});

test("the commands still to come say so, and do not report success", async () => {
  const result = await run(["link"], anywhere, context());

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /`repanel link` is not implemented yet/);
});

test("an unknown command is a usage error", async () => {
  const result = await run(["validaet"], anywhere, context());

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /Unknown command `validaet`/);
});

test("an unknown option is refused rather than ignored", async () => {
  const result = await run(["validate", "--fix"], anywhere, context());

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /--fix/);
});

test("a command that takes no arguments says so", async () => {
  const result = await run(["validate", "./somewhere"], anywhere, context());

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /takes no arguments/);
});

test("an option belongs to the command that takes it", async () => {
  const result = await run(["validate", "--port", "5170"], anywhere, context());

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /`repanel validate` does not take `--port`/);
});

test("a port that is not a port is a usage error, not a default", async () => {
  const result = await run(["dev", "--port", "http"], anywhere, context());

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /`--port` takes a port number/);
});

test("`dev` with nothing to serve reports the problems and opens no port", async () => {
  const result = await run(["dev"], anywhere, context());

  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join("\n"), /No definition found/);
  assert.match(result.lines.at(-1) ?? "", /nothing to serve yet/);
});
