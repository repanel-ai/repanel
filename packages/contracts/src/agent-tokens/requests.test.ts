import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgentTokenRequestSchema } from "./requests.js";

function labelErrors(label: unknown): string[] {
  const result = createAgentTokenRequestSchema.safeParse({ label });
  if (result.success) throw new Error("expected the request to be rejected");
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
}

test("createAgentToken trims the label", () => {
  assert.equal(
    createAgentTokenRequestSchema.parse({ label: "  Claude Code  " }).label,
    "Claude Code",
  );
});

test("createAgentToken refuses to take a token from the caller", () => {
  const parsed = createAgentTokenRequestSchema.parse({
    label: "Claude Code",
    token: "rpk_someone_elses",
  });

  assert.deepEqual(Object.keys(parsed), ["label"]);
});

test("createAgentToken rejects a label that is only whitespace", () => {
  assert.deepEqual(labelErrors("   "), ["label must not be empty"]);
});

test("createAgentToken rejects a label past a hundred characters", () => {
  assert.deepEqual(labelErrors("t".repeat(101)), ["label must be at most 100 characters"]);
});
