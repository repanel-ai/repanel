import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { readSession, sessionFile, writeSession } from "./session.js";

const API = "https://api.example.test";

const homes: string[] = [];
after(() => Promise.all(homes.map((home) => rm(home, { recursive: true, force: true }))));

async function home(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "repanel-home-"));
  homes.push(directory);
  return directory;
}

test("a session is read back for the deployment it was filed against", async () => {
  const where = await home();

  await writeSession(where, { apiUrl: API, token: "tok-1" });

  assert.equal(await readSession(where, API), "tok-1");
});

test("a token filed against another deployment is not offered to this one", async () => {
  const where = await home();

  await writeSession(where, { apiUrl: API, token: "tok-1" });

  // Pointing the CLI at a second RePanel must not send it the first one's
  // credential — which is the whole reason the file names its issuer.
  assert.equal(await readSession(where, "https://other.example.test"), undefined);
});

test("a machine that has never signed in has no session, and that is not an error", async () => {
  assert.equal(await readSession(await home(), API), undefined);
});

test("a file that cannot be read as a session reads as no session", async () => {
  const where = await home();
  await mkdir(path.dirname(sessionFile(where)), { recursive: true });
  await writeFile(sessionFile(where), "{ not json");

  assert.equal(await readSession(where, API), undefined);
});

test("the file is readable by its owner and nobody else, even when replaced", async () => {
  const where = await home();
  await mkdir(path.dirname(sessionFile(where)), { recursive: true });
  await writeFile(sessionFile(where), "{}", { mode: 0o644 });

  await writeSession(where, { apiUrl: API, token: "tok-1" });

  const mode = (await stat(sessionFile(where))).mode & 0o777;
  assert.equal(mode, 0o600, "a credential in a world-readable file is not a credential");
});

test("nothing but the deployment and the token is written down", async () => {
  const where = await home();

  await writeSession(where, { apiUrl: API, token: "tok-1" });

  const stored: unknown = JSON.parse(await readFile(sessionFile(where), "utf8"));
  assert.deepEqual(Object.keys(stored as object).sort(), ["apiUrl", "token"]);
});
