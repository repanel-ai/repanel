import assert from "node:assert/strict";
import { test } from "node:test";
import { reportProblems, reportReloaded, reportWhileServing, type Problem } from "./problems.js";
import { styling } from "./terminal.js";

const plain = styling(false);

const BROKEN: Problem = {
  file: "repanel/resources/users.json",
  path: "fields.2.type",
  message: "`enum` needs the values it may take.",
  expected: "a non-empty `values` array",
  hint: "Add `\"values\": [\"active\", \"suspended\"]` beside the type.",
};

const ALSO_BROKEN: Problem = {
  file: "repanel/app.json",
  path: "navigation.0.resources.1",
  message: "`invoices` is not a resource this definition declares.",
  expected: "one of `users`, `orders`",
  hint: "Remove it, or add `repanel/resources/invoices.json`.",
};

test("a save that put it right says so in one line and nothing else", () => {
  assert.equal(reportReloaded(plain, 5), "  ✓  Definition reloaded — 5 resources.");
  assert.match(reportReloaded(plain, 1), /1 resource\.$/);
});

/**
 * A running command counts first and lists after, which is the opposite of
 * `validate` — what an operator needs to know while a server is up is that the
 * screen in front of them is still the last good one.
 */
test("a save that broke it counts first, then says what is still on screen", () => {
  const lines = reportWhileServing(plain, [BROKEN], "repanel");

  assert.equal(lines[0], "  ✗  1 problem in repanel/ — still serving the last definition that validated.");
  assert.match(reportProblems([BROKEN]).at(-1) ?? "", /^1 problem found\.$/);
});

test("every problem sits under the line that counted them, path and hint alike", () => {
  const lines = reportWhileServing(plain, [BROKEN, ALSO_BROKEN], "repanel");

  assert.match(lines[0] ?? "", /2 problems/);
  for (const line of lines.slice(1)) assert.match(line, /^ {5}/, `\`${line}\` is not indented`);

  assert.equal(lines[1], "     repanel/resources/users.json · fields.2.type");
  assert.match(lines[2] ?? "", /^ {7}`enum` needs the values it may take\.$/);
  assert.match(lines[3] ?? "", /^ {7}expected: a non-empty `values` array$/);
  assert.match(lines[4] ?? "", /^ {7}hint: Add /);
  assert.equal(lines[5], "     repanel/app.json · navigation.0.resources.1");
});

/** The mark is the layout; the colour is what a plain terminal loses. */
test("the same lines carry a colour where there is one to carry", () => {
  const loud = reportWhileServing(styling(true), [BROKEN], "repanel");

  assert.match(loud[0] ?? "", /\[/);
  assert.ok((loud[0] ?? "").includes("✗"));
  assert.doesNotMatch(loud[1] ?? "", /\[/);
});
