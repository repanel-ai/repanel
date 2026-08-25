import { ROOT_PATH } from "@repanel/contracts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { locate, type DefinitionSource } from "./sources.js";

const sources: DefinitionSource[] = [
  { path: "", file: "repanel/app.json" },
  { path: "resources[0]", file: "repanel/resources/users.json" },
  { path: "resources[1]", file: "repanel/resources/orders.json" },
  { path: "resources[10]", file: "repanel/resources/zones.json" },
];

test("a problem inside a resource is located in that resource's file", () => {
  assert.deepEqual(locate(sources, "resources[1].views.table.columns[0]"), {
    file: "repanel/resources/orders.json",
    path: "views.table.columns[0]",
  });
});

test("a problem with the resource itself is located at the file's root", () => {
  assert.deepEqual(locate(sources, "resources[0]"), {
    file: "repanel/resources/users.json",
    path: ROOT_PATH,
  });
});

test("a problem outside every resource is located in the file that supplied the root", () => {
  assert.deepEqual(locate(sources, "navigation[0].resources[1]"), {
    file: "repanel/app.json",
    path: "navigation[0].resources[1]",
  });
});

test("an index is matched whole: resources[1] does not claim resources[10]", () => {
  assert.equal(locate(sources, "resources[10].key").file, "repanel/resources/zones.json");
});
