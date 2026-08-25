import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { describeDatabase, findDatabaseUrl, maskDatabaseUrl } from "./database-url.js";

const DSN = "postgres://crewbase:hunter2@localhost:5433/crewbase";

const written: string[] = [];
after(() => Promise.all(written.map((root) => rm(root, { recursive: true, force: true }))));

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "repanel-env-"));
  written.push(root);
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(path.join(root, name), contents);
  }
  return root;
}

test("what the operator typed wins, and needs no confirming", async () => {
  const root = await project({ ".env": `DATABASE_URL=${DSN}` });

  const found = await findDatabaseUrl(root, "postgres://typed/db", { DATABASE_URL: "postgres://shell/db" });

  assert.deepEqual(found, { url: "postgres://typed/db", origin: "--database-url", answered: true });
});

test("a DSN already in the environment is taken as an answer, not a guess", async () => {
  const root = await project({ ".env": `DATABASE_URL=${DSN}` });

  const found = await findDatabaseUrl(root, undefined, { DATABASE_URL: "postgres://shell/db" });

  assert.equal(found?.url, "postgres://shell/db");
  assert.equal(found?.answered, true);
});

test("`.env.local` is read before `.env`, and both are only a guess", async () => {
  const root = await project({ ".env": `DATABASE_URL=${DSN}`, ".env.local": "DATABASE_URL=postgres://local/db" });

  const found = await findDatabaseUrl(root, undefined, {});

  assert.deepEqual(found, { url: "postgres://local/db", origin: ".env.local", answered: false });
});

test("an env file is read, never loaded", async () => {
  const root = await project({ ".env": "DATABASE_URL=postgres://read/db\nSOMETHING_ELSE=x" });

  await findDatabaseUrl(root, undefined, {});

  assert.equal(process.env.SOMETHING_ELSE, undefined);
  assert.equal(process.env.DATABASE_URL, undefined);
});

test("a project with no database anywhere says nothing rather than guessing", async () => {
  assert.equal(await findDatabaseUrl(await project({}), undefined, {}), undefined);
});

test("an empty declaration is not a database", async () => {
  const root = await project({ ".env": "DATABASE_URL=" });

  assert.equal(await findDatabaseUrl(root, undefined, {}), undefined);
});

test("the password never reaches the screen", () => {
  const masked = maskDatabaseUrl(DSN);

  assert.equal(masked, "postgres://crewbase:****@localhost:5433/crewbase");
  assert.doesNotMatch(masked, /hunter2/);
});

test("the keyword form is masked too", () => {
  const masked = maskDatabaseUrl("host=localhost user=crewbase password=hunter2 dbname=crewbase");

  assert.doesNotMatch(masked, /hunter2/);
  assert.match(masked, /host=localhost/);
});

test("a DSN with no password is shown exactly as it was written", () => {
  const dsn = "postgres://localhost:5433/crewbase";

  assert.equal(maskDatabaseUrl(dsn), dsn);
});

test("the banner names the database without any of the credential", () => {
  assert.equal(describeDatabase(DSN), "localhost:5433/crewbase");
  assert.doesNotMatch(describeDatabase(DSN), /hunter2|crewbase:/);
});
