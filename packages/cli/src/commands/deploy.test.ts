import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { multiFileLayout, writeProject } from "../assemble/project.test-helpers.js";
import { FakeCloud } from "../cloud/cloud.test-helpers.js";
import { PROJECT_FILE, writeProjectKey } from "../cloud/project-file.js";
import { writeSession } from "../cloud/session.js";
import { deploy, type DeployOptions } from "./deploy.js";

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

/** A repository holding a definition, linked to the project unless told not to. */
async function repository(
  files: Record<string, unknown> = multiFileLayout(),
  /** `null` for a repository nobody has linked. */
  key: string | null = CREWBASE.key,
): Promise<string> {
  const root = await writeProject(files);
  written.push(root);
  if (key !== null) await writeProjectKey(root, key);
  return root;
}

async function home(token = "tok-1"): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "repanel-home-"));
  written.push(directory);
  await writeSession(directory, { apiUrl: cloud.url, token: cloud.issue(token) });
  return directory;
}

function options(where: string, overrides: Partial<DeployOptions> = {}): DeployOptions {
  return { env: { REPANEL_API_URL: cloud.url }, home: where, ...overrides };
}

test("a valid definition is submitted whole, and the admin's address comes back", async () => {
  const root = await repository();

  const result = await deploy(root, options(await home()));

  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.match(result.lines.join("\n"), /Submitted to Crewbase\./);
  assert.match(result.lines.join("\n"), new RegExp(`Admin\\s+http://127\\.0\\.0\\.1:5174/a/${CREWBASE.key}`));

  // One object, composed here and replaced there: the resources are in it.
  const submitted = cloud.submitted.at(-1) as { resources?: unknown[] };
  assert.equal(submitted.resources?.length, 3);
});

test("a problem is reported in the file that holds it, exactly as `validate` reports it", async () => {
  const layout = multiFileLayout();
  (layout["resources/users.json"] as { fields: unknown[] }).fields[0] = {
    key: "id",
    label: "ID",
    type: "nope",
  };
  const root = await repository(layout);
  const before = cloud.submitted.length;

  const result = await deploy(root, options(await home("tok-2")));

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines[0], "repanel/resources/users.json · fields[0].type");
  assert.match(result.lines[3] ?? "", /^ {2}hint: /);
  assert.equal(result.lines.at(-1), "1 problem found.");
  // It was submitted all the same: an invalid draft is stored, so the verdict
  // is what came back rather than what this command decided on its own.
  assert.equal(cloud.submitted.length, before + 1);
});

test("a definition that cannot be composed at all is answered here, without a round trip", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "repanel-empty-"));
  written.push(root);
  await writeProjectKey(root, CREWBASE.key);
  const before = cloud.submitted.length;

  const result = await deploy(root, options(await home("tok-4")));

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /No definition found/);
  assert.match(result.lines[1] ?? "", /^ {2}hint: /);
  // An arrangement problem is this machine's to report: there is no object to
  // submit, so nothing was sent.
  assert.equal(cloud.submitted.length, before);
});

test("a machine that has not signed in is sent to `repanel link`", async () => {
  const nowhere = await mkdtemp(path.join(tmpdir(), "repanel-home-"));
  written.push(nowhere);

  const result = await deploy(await repository(), options(nowhere));

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /not signed in/);
  assert.match(result.lines[1] ?? "", /repanel link/);
});

test("a repository nobody linked names the file that would say where it goes", async () => {
  const root = await repository(multiFileLayout(), null);

  const result = await deploy(root, options(await home("tok-5")));

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", new RegExp(escape(PROJECT_FILE)));
  assert.match(result.lines[1] ?? "", /--project <key>/);
});

test("a project named outright overrides the linked one, and an unknown key is refused", async () => {
  const root = await repository(multiFileLayout(), "gone-x1y2z3");

  const named = await deploy(root, options(await home("tok-6"), { project: CREWBASE.key }));
  assert.equal(named.exitCode, 0, named.lines.join("\n"));

  const linked = await deploy(root, options(await home("tok-7")));
  assert.equal(linked.exitCode, 1);
  assert.match(linked.lines[0] ?? "", /No project with the key `gone-x1y2z3`/);
});

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
