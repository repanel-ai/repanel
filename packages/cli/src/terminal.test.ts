import assert from "node:assert/strict";
import { test } from "node:test";
import { colorsAllowed, styling } from "./terminal.js";

/** The start of any SGR sequence, which is the whole of what colour looks like. */
const ESCAPE = /\[/;

test("colour is spent where there is a terminal to render it", () => {
  assert.equal(colorsAllowed(true, {}), true);
});

test("colour is not spent into a pipe, a log file or a CI run", () => {
  assert.equal(colorsAllowed(false, {}), false);
});

/**
 * The convention is that the variable's presence is the answer, whatever it is
 * set to — including `0`, which somebody who meant "off" would reasonably
 * write and somebody who meant "on" would too. An empty one is not set.
 */
test("NO_COLOR takes it away whatever it is set to, and an empty one asks nothing", () => {
  for (const value of ["1", "0", "yes", "false"]) {
    assert.equal(colorsAllowed(true, { NO_COLOR: value }), false, `NO_COLOR=${value}`);
  }
  assert.equal(colorsAllowed(true, { NO_COLOR: "" }), true);
});

test("colour on writes codes; colour off writes the same words with none", () => {
  const loud = styling(true);
  const plain = styling(false);

  assert.match(loud.label("Database"), ESCAPE);
  assert.match(loud.headline("the address"), ESCAPE);
  assert.match(loud.ok, ESCAPE);

  assert.equal(plain.label("Database"), "Database");
  assert.equal(plain.headline("the address"), "the address");
  assert.doesNotMatch(plain.ok, ESCAPE);
});

/** A terminal that never said it could render colour is one that cannot. */
test("an unstated answer is no", () => {
  assert.doesNotMatch(styling(undefined).label("Database"), ESCAPE);
});

/** The marks are the layout rather than the colour, so they survive it going. */
test("the marks are there either way", () => {
  for (const style of [styling(true), styling(false)]) {
    assert.ok(style.ok.includes("✓"));
    assert.ok(style.warn.includes("⚠"));
    assert.ok(style.bad.includes("✗"));
  }
});
