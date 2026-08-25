import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { multiFileLayout, writeProject } from "../assemble/project.test-helpers.js";
import { FakeCloud } from "../cloud/cloud.test-helpers.js";
import { PROJECT_FILE } from "../cloud/project-file.js";
import { sessionFile, writeSession } from "../cloud/session.js";
import type { Terminal } from "../terminal.js";
import { link, type LinkOptions } from "./link.js";

const DSN = "postgres://crewbase:hunter2@localhost:5433/crewbase";
const CONSOLE = "http://127.0.0.1:5173";

const cloud = await FakeCloud.started();
const written: string[] = [];
after(async () => {
  await cloud.close();
  await Promise.all(written.map((directory) => rm(directory, { recursive: true, force: true })));
});

const CREWBASE = cloud.add({
  id: "id-crewbase",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-25T09:00:00.000Z",
});

/** A repository with a definition and an `.env`, as a developer's would be. */
async function repository(env = `DATABASE_URL=${DSN}\n`): Promise<string> {
  const root = await writeProject(multiFileLayout());
  written.push(root);
  if (env !== "") await writeFile(path.join(root, ".env"), env);
  return root;
}

/** A home directory this test owns, optionally already signed in. */
async function home(token?: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "repanel-home-"));
  written.push(directory);
  if (token !== undefined) {
    await writeSession(directory, { apiUrl: cloud.url, token: cloud.issue(token) });
  }
  return directory;
}

interface Script {
  /** What `ask` answers, in order. */
  readonly answers?: readonly string[];
  /** What `confirm` answers. Absent means there is nobody at a terminal. */
  readonly confirm?: boolean;
  /** What the browser does with the address it is given. */
  readonly browse?: (opened: URL) => Promise<void>;
}

interface Recording extends Terminal {
  readonly written: string[];
  readonly asked: string[];
}

function terminal({ answers = [], confirm, browse }: Script = {}): Recording {
  const lines: string[] = [];
  const asked: string[] = [];
  const queued = [...answers];

  return {
    written: lines,
    asked,
    write: (line) => void lines.push(line),
    ...(confirm === undefined
      ? {}
      : {
          ask: (question: string) => {
            asked.push(question);
            return Promise.resolve(queued.shift() ?? "");
          },
          confirm: (question: string) => {
            asked.push(question);
            return Promise.resolve(confirm);
          },
        }),
    ...(browse === undefined ? {} : { browse: (url: string) => void browse(new URL(url)) }),
  };
}

function options(where: string, overrides: Partial<LinkOptions> = {}): LinkOptions {
  return {
    env: { REPANEL_API_URL: cloud.url, REPANEL_CONSOLE_URL: CONSOLE },
    home: where,
    ...overrides,
  };
}

test("a project is chosen, the database is confirmed, and the two are connected", async () => {
  const root = await repository();
  const io = terminal({ answers: ["1"], confirm: true });

  const result = await link(root, options(await home("tok-1")), io);

  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.deepEqual(cloud.connected.at(-1), { projectId: CREWBASE.id, dsn: DSN });
  assert.equal(await readFile(path.join(root, PROJECT_FILE), "utf8"), `${CREWBASE.key}\n`);
  // The acknowledgement repeats the confirmation word for word, port and all.
  assert.match(result.lines.join("\n"), /Connected localhost:5433\/crewbase to Crewbase/);
});

test("the confirmation names the database the way every other surface names it", async () => {
  const root = await repository();
  const io = terminal({ answers: ["1"], confirm: true });

  await link(root, options(await home("tok-2")), io);

  const question = io.asked.at(-1) ?? "";
  assert.match(question, /^Connect localhost:5433\/crewbase to Crewbase\? \[Y\/n\] $/);
});

test("a database that was not confirmed is not sent", async () => {
  const root = await repository();
  const before = cloud.connected.length;

  const result = await link(root, options(await home("tok-3")), terminal({ answers: ["1"], confirm: false }));

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /nothing was sent to RePanel/);
  assert.equal(cloud.connected.length, before);
  // Nothing was linked either: the two happen together or not at all.
  await assert.rejects(readFile(path.join(root, PROJECT_FILE), "utf8"));
});

test("a repository with no DATABASE_URL is told where to put one, and that it is not an option", async () => {
  const root = await repository("");

  const result = await link(root, options(await home("tok-4")), terminal({ answers: ["1"], confirm: true }));

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /No DATABASE_URL found/);
  assert.match(result.lines.join("\n"), /shell history/);
});

test("a project named outright is used; a key this account does not have is refused", async () => {
  const root = await repository();

  const named = await link(
    root,
    options(await home("tok-5"), { project: CREWBASE.key }),
    terminal({ confirm: true }),
  );
  assert.equal(named.exitCode, 0, named.lines.join("\n"));

  const unknown = await link(
    root,
    options(await home("tok-6"), { project: "ledger-x1y2z3" }),
    terminal({ confirm: true }),
  );
  assert.equal(unknown.exitCode, 1);
  assert.match(unknown.lines[0] ?? "", /No project with the key `ledger-x1y2z3`/);
});

test("an answer that is not one of the choices stops rather than picking one", async () => {
  const root = await repository();

  const result = await link(root, options(await home("tok-7")), terminal({ answers: ["7"], confirm: true }));

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /`7` is not one of the choices/);
});

test("a machine with no session signs in through the browser before anything else", async () => {
  const root = await repository();
  const where = await home();
  const token = cloud.issue("from-the-browser");

  const io = terminal({
    answers: ["1"],
    confirm: true,
    browse: async (opened) => {
      // What the console does: mints a session against its own and hands it
      // back to the port the CLI is listening on.
      const callback = new URL(`http://127.0.0.1:${opened.searchParams.get("port")}/`);
      callback.searchParams.set("state", opened.searchParams.get("state") ?? "");
      callback.searchParams.set("token", token);
      await fetch(callback);
    },
  });

  const result = await link(root, options(where), io);

  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.match(io.written.join("\n"), /Signed in as ada@example\.com/);
  const stored: unknown = JSON.parse(await readFile(sessionFile(where), "utf8"));
  assert.deepEqual(stored, { apiUrl: cloud.url, token });
});

test("an account with no projects is offered one, named after the repository", async () => {
  const empty = await FakeCloud.started();
  try {
    const root = await repository();
    const where = await mkdtemp(path.join(tmpdir(), "repanel-home-"));
    written.push(where);
    await writeSession(where, { apiUrl: empty.url, token: empty.issue("tok-new") });

    // An empty answer takes the suggestion, which is the directory's own name.
    const io = terminal({ answers: [""], confirm: true });
    const result = await link(
      root,
      { env: { REPANEL_API_URL: empty.url, REPANEL_CONSOLE_URL: CONSOLE }, home: where },
      io,
    );

    assert.equal(result.exitCode, 0, result.lines.join("\n"));
    assert.match(io.asked[0] ?? "", new RegExp(`Name the new project \\[${path.basename(root)}\\]`));
    assert.equal(empty.projects[0]?.name, path.basename(root));
    assert.equal(await readFile(path.join(root, PROJECT_FILE), "utf8"), `${empty.projects[0]?.key}\n`);
  } finally {
    await empty.close();
  }
});

test("with nobody at a terminal, nothing is chosen and nothing is confirmed", async () => {
  const root = await repository();

  const result = await link(root, options(await home("tok-8")), terminal());

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /Nobody to ask/);
});

test("the connection string appears in no log, no file, and no argument", async () => {
  const root = await repository();
  const where = await home("tok-9");
  const io = terminal({ answers: ["1"], confirm: true });

  const result = await link(root, options(where), io);
  assert.equal(result.exitCode, 0, result.lines.join("\n"));

  // It arrived where it was sent, which is the only place it may be.
  assert.equal(cloud.connected.at(-1)?.dsn, DSN);

  const printed = [...io.written, ...io.asked, ...result.lines].join("\n");
  assert.doesNotMatch(printed, /hunter2/, "the password was printed");
  assert.doesNotMatch(printed, new RegExp(escape(DSN)), "the connection string was printed");

  // `.env` is where it came from; every other file this command touched, in
  // the repository and in the operator's own directory, must not hold it.
  for (const file of [...(await tree(root)), ...(await tree(where))]) {
    if (path.basename(file) === ".env") continue;
    const contents = await readFile(file, "utf8");
    assert.ok(!contents.includes("hunter2"), `${file} holds the password`);
    assert.ok(!contents.includes(DSN), `${file} holds the connection string`);
  }

  assert.ok(!process.argv.join(" ").includes("hunter2"), "the password reached the command line");
});

/** Every file under a directory, so a promise about "nowhere" can be checked. */
async function tree(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await tree(full)));
    else files.push(full);
  }
  return files;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
