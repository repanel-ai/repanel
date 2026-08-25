import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { multiFileLayout, removeProject, writeProject } from "../assemble/project.test-helpers.js";
import { writeAssets } from "../dev/dev.test-helpers.js";
import type { Terminal } from "../terminal.js";
import { dev, type DevOptions, type DevOutcome } from "./dev.js";

/** Stands in for the runtime this package embeds when it is built. */
const assets = await writeAssets();

const DSN = "postgres://crewbase:hunter2@localhost:5433/crewbase";

/** A terminal that records what it was told, and answers what it was told to. */
function terminal(
  answer?: boolean,
  colors = false,
): Terminal & { written: string[]; asked: string[] } {
  const written: string[] = [];
  const asked: string[] = [];
  return {
    written,
    asked,
    colors,
    write: (line) => void written.push(line),
    ...(answer === undefined
      ? {}
      : {
          confirm: (question: string) => {
            asked.push(question);
            return Promise.resolve(answer);
          },
        }),
  };
}

function options(overrides: Partial<DevOptions> = {}): DevOptions {
  return { port: 0, yes: false, env: {}, assets, ...overrides };
}

/** A project whose definition validates, with an `.env` beside it. */
async function project(env?: string): Promise<string> {
  const root = await writeProject(multiFileLayout());
  if (env !== undefined) await writeFile(path.join(root, ".env"), env);
  return root;
}

async function stop(outcome: DevOutcome): Promise<void> {
  if (outcome.started) await outcome.close();
}

test("a project with no database anywhere is told both ways to name one", async () => {
  const root = await project();
  try {
    const outcome = await dev(root, options(), terminal(true));

    assert.equal(outcome.started, false);
    assert.equal(outcome.started === false && outcome.result.exitCode, 1);
    const said = outcome.started === false ? outcome.result.lines.join("\n") : "";
    assert.match(said, /No DATABASE_URL found/);
    assert.match(said, /--database-url/);
    assert.match(said, /`\.env`/);
  } finally {
    await removeProject(root);
  }
});

test("a database found in a file is confirmed before anything connects to it", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  const io = terminal(true);
  try {
    const outcome = await dev(root, options(), io);

    assert.equal(io.asked.length, 1);
    assert.match(io.asked[0] ?? "", /Use this database\?/);
    assert.equal(outcome.started, true);
    await stop(outcome);
  } finally {
    await removeProject(root);
  }
});

test("the password is not in anything the confirmation prints", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  const io = terminal(true);
  try {
    await stop(await dev(root, options(), io));

    assert.match(io.written.join("\n"), /postgres:\/\/crewbase:\*\*\*\*@localhost:5433/);
    assert.doesNotMatch(io.written.join("\n"), /hunter2/);
  } finally {
    await removeProject(root);
  }
});

test("a declined database stops the command rather than picking one", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  try {
    const outcome = await dev(root, options(), terminal(false));

    assert.equal(outcome.started, false);
    const said = outcome.started === false ? outcome.result.lines.join("\n") : "";
    assert.match(said, /no database was confirmed/);
    assert.match(said, /--database-url/);
  } finally {
    await removeProject(root);
  }
});

test("with nobody to ask, an inferred database is refused rather than assumed", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  try {
    const outcome = await dev(root, options(), terminal());

    assert.equal(outcome.started, false);
    const said = outcome.started === false ? outcome.result.lines.join("\n") : "";
    assert.match(said, /not an interactive terminal/);
    assert.match(said, /--yes/);
  } finally {
    await removeProject(root);
  }
});

test("`--yes` is how a script says it accepts the inferred database", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  const io = terminal();
  try {
    const outcome = await dev(root, options({ yes: true }), io);

    assert.equal(outcome.started, true);
    await stop(outcome);
  } finally {
    await removeProject(root);
  }
});

test("a database named on the command line is an answer, and is not asked about", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  const io = terminal(true);
  try {
    const outcome = await dev(root, options({ databaseUrl: "postgres://named/db" }), io);

    assert.deepEqual(io.asked, []);
    assert.equal(outcome.started, true);
    await stop(outcome);
  } finally {
    await removeProject(root);
  }
});

test("the run's action secret is printed once, and is a different one each run", async () => {
  const root = await project();
  const secrets: string[] = [];
  try {
    for (const _run of [1, 2]) {
      const io = terminal();
      const outcome = await dev(root, options({ databaseUrl: DSN }), io);
      assert.equal(outcome.started, true);

      const printed = io.written.filter((line) => line.includes("REPANEL_ACTION_SECRET="));
      assert.equal(printed.length, 1, "printed once, so it is not in the scrollback twice");
      secrets.push(printed[0]?.split("=")[1] ?? "");
      await stop(outcome);
    }

    assert.notEqual(secrets[0], secrets[1]);
    assert.ok((secrets[0] ?? "").length >= 32);
  } finally {
    await removeProject(root);
  }
});

test("the banner names the address it actually bound", async () => {
  const root = await project();
  const io = terminal();
  const outcome = await dev(root, options({ databaseUrl: DSN }), io);
  try {
    assert.equal(outcome.started, true);
    if (!outcome.started) return;

    assert.match(outcome.url, /^http:\/\/127\.0\.0\.1:\d+\/a\/local\/$/);
    assert.doesNotMatch(outcome.url, /:0\//);
    assert.ok(io.written.some((line) => line.includes(outcome.url)));
  } finally {
    await stop(outcome);
    await removeProject(root);
  }
});

test("a definition that does not validate opens no port and reads as `validate` did", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "repanel-empty-"));
  try {
    const outcome = await dev(root, options({ databaseUrl: DSN }), terminal(true));

    assert.equal(outcome.started, false);
    const said = outcome.started === false ? outcome.result.lines : [];
    assert.match(said.join("\n"), /No definition found/);
    assert.match(said.at(-1) ?? "", /nothing to serve yet/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** The start of any SGR sequence, which is the whole of what colour looks like. */
const ESCAPE = /\[/;

/** The line a gutter label introduces. */
function lineFor(io: { written: string[] }, label: string): string {
  return io.written.find((line) => line.trimStart().startsWith(label)) ?? "";
}

/** Where the value starts on a gutter line, which is what "aligned" means. */
function valueColumn(line: string): number {
  return line.length - line.replace(/^ {2}\S+ +/, "").length;
}

test("the boot output is one gutter, one loud line, and two marked statements", async () => {
  const root = await project();
  const io = terminal();
  const outcome = await dev(root, options({ databaseUrl: DSN }), io);
  try {
    assert.equal(outcome.started, true);
    if (!outcome.started) return;

    const rows = ["Admin", "Database", "Watching"].map((label) => lineFor(io, label));
    for (const row of rows) assert.match(row, /^ {2}\S/, `\`${row}\` is not in the gutter`);
    assert.equal(new Set(rows.map(valueColumn)).size, 1, "the values do not line up");
    assert.ok((rows[0] ?? "").includes(outcome.url), "the admin row is not the address");

    // One mark on each of the two statements, and what follows each is indented
    // to the mark's own text column.
    const said = io.written.join("\n");
    assert.match(said, /^ {2}⚠ {2}Actions are signed/m);
    assert.match(said, /^ {5}in your application's environment/m);
    assert.match(said, /^ {2}✓ {2}No account and no RePanel network calls/m);
    assert.match(said, /^ {5}this process opens are the database above/m);

    // The secret alone on its line, so it can be taken without taking anything
    // else along with it.
    assert.match(
      io.written.find((line) => line.includes("REPANEL_ACTION_SECRET=")) ?? "",
      /^ +REPANEL_ACTION_SECRET=[\w-]+$/,
    );

    // Blank lines between the groups rather than inside them.
    assert.ok(io.written.filter((line) => line === "").length >= 4);
  } finally {
    await stop(outcome);
    await removeProject(root);
  }
});

test("nothing that cannot render a colour is sent one", async () => {
  const root = await project();
  const io = terminal();
  const outcome = await dev(root, options({ databaseUrl: DSN }), io);
  try {
    for (const line of io.written) assert.doesNotMatch(line, ESCAPE, line);
  } finally {
    await stop(outcome);
    await removeProject(root);
  }
});

test("a terminal that can render one gets the address loud, over the same layout", async () => {
  const root = await project();
  const io = terminal(undefined, true);
  const outcome = await dev(root, options({ databaseUrl: DSN }), io);
  try {
    assert.equal(outcome.started, true);
    if (!outcome.started) return;

    const admin = io.written.find((line) => line.includes(outcome.url)) ?? "";
    assert.match(admin, ESCAPE, "the address is not the loud line");

    // The layout is the same one either way: colour goes on top of it rather
    // than instead of it.
    const said = io.written.join("\n");
    assert.ok(said.includes("Actions are signed for this run") || said.includes("Actions are signed"));
    assert.match(said, /^ {5}in your application's environment/m);

    // The secret stays bare, because it is going to be selected and pasted.
    assert.doesNotMatch(
      io.written.find((line) => line.includes("REPANEL_ACTION_SECRET=")) ?? "",
      ESCAPE,
    );
  } finally {
    await stop(outcome);
    await removeProject(root);
  }
});

test("the question about a database puts it in the banner's own gutter", async () => {
  const root = await project(`DATABASE_URL=${DSN}`);
  const io = terminal(true);
  try {
    const outcome = await dev(root, options(), io);

    assert.match(lineFor(io, "Database"), /^ {2}Database {3}postgres:\/\/crewbase:\*+@localhost:5433/);
    assert.match(lineFor(io, "Found in"), /^ {2}Found in {3}\.env$/);
    assert.match(io.asked[0] ?? "", /^ {2}Use this database\? \[Y\/n\] $/);

    await stop(outcome);
  } finally {
    await removeProject(root);
  }
});
