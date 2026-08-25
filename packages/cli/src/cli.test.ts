import assert from "node:assert/strict";
import { test } from "node:test";
import { run, type CliContext } from "./cli.js";

const anywhere = process.cwd();

/** A terminal nobody is at: whatever a command writes is collected, not printed. */
function context(): CliContext & { written: string[] } {
  const written: string[] = [];
  return { written, env: {}, home: anywhere, io: { write: (line) => void written.push(line) } };
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

test("a command that needs a terminal refuses when there is nobody at one", async () => {
  const result = await run(["link"], anywhere, context());

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /Nobody to ask/);
  assert.match(result.lines.join("\n"), /hint: /);
});

test("an option belongs to whichever commands take it, and is refused elsewhere", async () => {
  const named = await run(["--project", "crewbase"], anywhere, context());
  assert.equal(named.exitCode, 2);
  assert.match(named.lines[0] ?? "", /`repanel link` and `repanel deploy` take it/);

  const wrong = await run(["dev", "--project", "crewbase"], anywhere, context());
  assert.equal(wrong.exitCode, 2);
  assert.match(wrong.lines[0] ?? "", /`repanel dev` does not take `--project`/);
});

test("an empty project key is a usage error, not a missing one", async () => {
  const result = await run(["deploy", "--project", ""], anywhere, context());

  assert.equal(result.exitCode, 2);
  assert.match(result.lines[0] ?? "", /`--project` takes a project key/);
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
