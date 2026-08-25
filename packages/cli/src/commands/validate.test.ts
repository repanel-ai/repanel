import { saasDefinition } from "@repanel/contracts/fixtures";
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  multiFileLayout,
  removeProject,
  writeProject,
} from "../assemble/project.test-helpers.js";
import type { CommandResult } from "../command-result.js";
import { validate } from "./validate.js";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function validateLayout(files: Record<string, unknown>): Promise<CommandResult> {
  const root = await writeProject(files);
  try {
    return await validate(root);
  } finally {
    await removeProject(root);
  }
}

/** A field whose `type` is not one the schema knows. */
const unknownFieldType = { key: "id", label: "ID", type: "nope" };

test("a valid definition validates, and says what was read", async () => {
  const result = await validateLayout(multiFileLayout());

  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.deepEqual(result.lines, [
    "Acme Admin — 3 resources from repanel/, valid against definition schema 0.1.",
  ]);
});

test("a problem in a resource file is reported in that file, at its path inside it", async () => {
  const layout = multiFileLayout();
  (layout["resources/users.json"] as { fields: unknown[] }).fields[0] = unknownFieldType;

  const result = await validateLayout(layout);

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines[0], "repanel/resources/users.json · fields[0].type");
  assert.match(result.lines[3] ?? "", /^ {2}hint: /);
  assert.equal(result.lines.at(-1), "1 problem found.");
});

test("the single-file layout reports the same problem against its one file", async () => {
  const definition = structuredClone(saasDefinition) as { resources: { fields: unknown[] }[] };
  definition.resources[1]?.fields.splice(0, 1, unknownFieldType);

  const result = await validateLayout({ "definition.json": definition });

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines[0], "repanel/definition.json · resources[1].fields[0].type");
});

test("a layout problem is reported instead of a validation verdict", async () => {
  const result = await validateLayout({});

  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0] ?? "", /No definition found/);
  assert.match(result.lines[1] ?? "", /^ {2}hint: /);
});

test("the crewbase example validates", async () => {
  const result = await validate(path.join(repositoryRoot, "examples", "crewbase"));

  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.match(result.lines[0] ?? "", /^Crewbase Admin — 5 resources from repanel\/, valid/);
});
