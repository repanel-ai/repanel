import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { multiFileLayout, removeProject, writeProject } from "../assemble/project.test-helpers.js";
import { WatchedDefinition, readDefinition } from "./project.js";
import type { DefinitionEvent } from "./project.js";

const USERS = "repanel/resources/users.json";

/** Overwrites one file of a written project, the way an editor would. */
async function edit(root: string, relative: string, contents: string): Promise<void> {
  await writeFile(path.join(root, relative), contents);
}

async function started(): Promise<{ root: string; watched: WatchedDefinition }> {
  const root = await writeProject(multiFileLayout());
  const reading = await readDefinition(root);
  assert.ok(reading.definition, "the reference layout must read");
  return { root, watched: new WatchedDefinition(root, reading.definition) };
}

test("a valid definition directory reads as a definition and nothing else", async () => {
  const root = await writeProject(multiFileLayout());
  try {
    const reading = await readDefinition(root);

    assert.equal(reading.definition?.app.name, "Acme Admin");
    assert.deepEqual(reading.problems, []);
  } finally {
    await removeProject(root);
  }
});

test("a broken edit is reported and the last good definition keeps being served", async () => {
  const { root, watched } = await started();
  try {
    const before = watched.current;
    await edit(root, USERS, JSON.stringify({ key: "users", label: "not a label object" }));

    const event = await watched.reread();

    assert.equal(event.type, "problems");
    assert.equal(watched.current, before, "the definition being served did not move");
    assert.ok(watched.currentProblems.length > 0);
    assert.equal(watched.currentProblems[0]?.file, USERS);
  } finally {
    await removeProject(root);
  }
});

test("a file that is not JSON at all is reported against that file", async () => {
  const { root, watched } = await started();
  try {
    await edit(root, USERS, "{ nope");

    await watched.reread();

    assert.equal(watched.currentProblems.length, 1);
    assert.equal(watched.currentProblems[0]?.file, USERS);
    assert.match(watched.currentProblems[0]?.message ?? "", /is not valid JSON/);
    assert.match(watched.currentProblems[0]?.hint ?? "", /Fix the JSON syntax/);
  } finally {
    await removeProject(root);
  }
});

test("a repaired definition replaces the one being served and asks for a reload", async () => {
  const { root, watched } = await started();
  try {
    const layout = multiFileLayout();
    await edit(root, USERS, "{ nope");
    await watched.reread();
    assert.ok(watched.currentProblems.length > 0);

    const users = layout["resources/users.json"] as { label: { plural: string } };
    users.label = { ...users.label, plural: "People" };
    await edit(root, USERS, JSON.stringify(users));

    const event = await watched.reread();

    assert.equal(event.type, "reload");
    assert.deepEqual(watched.currentProblems, []);
    assert.equal(
      watched.current.resources.find((resource) => resource.key === "users")?.label.plural,
      "People",
    );
  } finally {
    await removeProject(root);
  }
});

test("a definition that only validation refuses is refused, not served", async () => {
  const { root, watched } = await started();
  try {
    const layout = multiFileLayout();
    const app = layout["app.json"] as { navigation: { label: string; resources: string[] }[] };
    app.navigation = [{ label: "Customers", resources: ["organizations", "users"] }];
    await edit(root, "repanel/app.json", JSON.stringify(app));

    await watched.reread();

    assert.equal(watched.currentProblems.length, 1);
    assert.match(watched.currentProblems[0]?.message ?? "", /no navigation group lists it/);
  } finally {
    await removeProject(root);
  }
});

test("whoever is listening hears both kinds of news, once each", async () => {
  const { root, watched } = await started();
  try {
    const heard: DefinitionEvent[] = [];
    const stop = watched.subscribe((event) => heard.push(event));

    await edit(root, USERS, "{ nope");
    await watched.reread();
    await edit(root, USERS, JSON.stringify(multiFileLayout()["resources/users.json"]));
    await watched.reread();

    stop();
    await watched.reread();

    assert.deepEqual(
      heard.map((event) => event.type),
      ["problems", "reload"],
      "and nothing after the listener let go",
    );
  } finally {
    await removeProject(root);
  }
});

test("reads run one after another, so the disk's last word is the one served", async () => {
  const { root, watched } = await started();
  try {
    const heard: DefinitionEvent["type"][] = [];
    watched.subscribe((event) => heard.push(event.type));

    await edit(root, USERS, "{ nope");
    const first = watched.reread();
    await edit(root, USERS, JSON.stringify(multiFileLayout()["resources/users.json"]));
    const second = watched.reread();
    await Promise.all([first, second]);

    // Whatever order the two reads were asked in, the answer that lands last is
    // the one for the file that is there now.
    assert.equal(heard.at(-1), "reload");
    assert.deepEqual(watched.currentProblems, []);
  } finally {
    await removeProject(root);
  }
});
