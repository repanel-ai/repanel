import { saasDefinition } from "@repanel/contracts/fixtures";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { assembleDefinition, type AssembledDefinition } from "./assemble.js";
import { AssemblyError } from "./errors.js";
import { multiFileLayout, removeProject, writeProject } from "./project.test-helpers.js";

async function assembleLayout(files: Record<string, unknown>): Promise<AssembledDefinition> {
  const root = await writeProject(files);
  try {
    return await assembleDefinition(root);
  } finally {
    await removeProject(root);
  }
}

async function refusalOf(files: Record<string, unknown>): Promise<AssemblyError> {
  try {
    await assembleLayout(files);
  } catch (error) {
    if (error instanceof AssemblyError) return error;
    throw error;
  }
  throw new Error("expected the definition to be refused");
}

function resourceKeysOf(definition: unknown): unknown[] {
  const resources = (definition as { resources: unknown[] }).resources;
  return resources.map((resource) => (resource as { key: unknown }).key);
}

test("the multi-file layout composes one definition", async () => {
  const { definition, sources } = await assembleLayout(multiFileLayout());

  assert.deepEqual(resourceKeysOf(definition), ["organizations", "users", "orders"]);
  assert.equal((definition as { app: { name: string } }).app.name, "Acme Admin");
  assert.deepEqual(sources, [
    { path: "", file: "repanel/app.json" },
    { path: "resources[0]", file: "repanel/resources/organizations.json" },
    { path: "resources[1]", file: "repanel/resources/users.json" },
    { path: "resources[2]", file: "repanel/resources/orders.json" },
  ]);
});

test("resources the navigation does not name are composed after it, by key", async () => {
  const { definition, sources } = await assembleLayout({
    "app.json": {
      schemaVersion: "0.1",
      app: { name: "Ordered" },
      navigation: [{ label: "First", resources: ["orders"] }],
    },
    "resources/zones.json": { key: "zones" },
    "resources/orders.json": { key: "orders" },
    "resources/airlines.json": { key: "airlines" },
  });

  assert.deepEqual(resourceKeysOf(definition), ["orders", "airlines", "zones"]);
  assert.equal(sources[1]?.file, "repanel/resources/orders.json");
});

test("the single-file layout is the same convention", async () => {
  const { definition, sources } = await assembleLayout({ "definition.json": saasDefinition });

  assert.deepEqual(resourceKeysOf(definition), ["organizations", "users", "orders"]);
  assert.deepEqual(sources, [{ path: "", file: "repanel/definition.json" }]);
});

test("a resource file named for another resource names both", async () => {
  const layout = multiFileLayout();
  layout["resources/customers.json"] = layout["resources/organizations.json"];
  delete layout["resources/organizations.json"];

  const error = await refusalOf(layout);
  assert.match(error.message, /repanel\/resources\/customers\.json/);
  assert.match(error.message, /`organizations`/);
  assert.match(error.hint, /Rename the file to `organizations\.json`/);
  assert.equal(error.file, "repanel/resources/customers.json");
});

test("a project with no definition says where one goes", async () => {
  const error = await refusalOf({});
  assert.match(error.message, /repanel\/definition\.json/);
  assert.match(error.message, /repanel\/app\.json/);
});

test("both layouts at once are refused rather than silently preferred", async () => {
  const error = await refusalOf({ ...multiFileLayout(), "definition.json": { schemaVersion: "0.1" } });
  assert.match(error.message, /repanel\/definition\.json/);
  assert.match(error.message, /repanel\/app\.json/);
});

test("a file that is not JSON is reported by name", async () => {
  const layout = multiFileLayout();
  layout["resources/users.json"] = "{ not json";

  const error = await refusalOf(layout);
  assert.equal(error.file, "repanel/resources/users.json");
  assert.match(error.message, /is not valid JSON/);
});

test("resources declared in app.json are refused, not composed over", async () => {
  const layout = multiFileLayout();
  layout["app.json"] = { ...(layout["app.json"] as object), resources: [] };

  const error = await refusalOf(layout);
  assert.equal(error.file, "repanel/app.json");
  assert.match(error.hint, /repanel\/resources\/<key>\.json/);
});

test("app.json without a resources directory says so", async () => {
  const error = await refusalOf({ "app.json": { schemaVersion: "0.1" } });
  assert.match(error.message, /`repanel\/resources\/` is missing/);
});

test("an empty resources directory says so", async () => {
  const root = await writeProject({ "app.json": { schemaVersion: "0.1" } });
  await mkdir(path.join(root, "repanel", "resources"));
  try {
    await assert.rejects(assembleDefinition(root), /holds no `\.json` files/);
  } finally {
    await removeProject(root);
  }
});
