import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { PROJECT_FILE, readProjectKey, writeProjectKey } from "./project-file.js";

const roots: string[] = [];
after(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "repanel-repo-"));
  roots.push(root);
  return root;
}

test("the project a repository is linked to is written down and read back", async () => {
  const root = await repository();

  await writeProjectKey(root, "crewbase-a3k9x2");

  assert.equal(await readProjectKey(root), "crewbase-a3k9x2");
});

test("the file holds the key and nothing else, which is what makes it committable", async () => {
  const root = await repository();

  await writeProjectKey(root, "crewbase-a3k9x2");

  assert.equal(await readFile(path.join(root, PROJECT_FILE), "utf8"), "crewbase-a3k9x2\n");
});

test("a repository nobody has linked names no project", async () => {
  assert.equal(await readProjectKey(await repository()), undefined);
});
