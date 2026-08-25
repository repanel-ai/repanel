/**
 * The generator's tests run against the real `docs/AUTHORING.md` rather than a
 * fixture: the rulings in `skill-from-authoring.mjs` are written about that
 * document, and a fixture would only prove they are consistent with themselves.
 * The two failure cases edit a copy of it in memory.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { skillFromAuthoring } from "./skill-from-authoring.mjs";

const guide = await readFile(new URL("../docs/AUTHORING.md", import.meta.url), "utf8");

test("the skill is front matter, a provenance line, and then the guide", () => {
  const skill = skillFromAuthoring(guide);

  assert.match(skill, /^---\nname: repanel\ndescription: .+\n---\n/);
  assert.match(skill, /<!-- Generated from docs\/AUTHORING\.md/);
  assert.match(skill, /\n# Authoring a RePanel definition\n/);
  // The last carried section arrives whole, and the file ends in one newline.
  const platforms = guide.slice(guide.indexOf("\n## Platforms\n"), guide.indexOf("\n## Integrations\n"));
  assert.ok(skill.endsWith(`${platforms.trim()}\n`));
});

test("every carried section arrives, in the guide's own order", () => {
  const headings = [...skillFromAuthoring(guide).matchAll(/^## (.+)$/gm)].map(([, h]) => h);

  assert.deepEqual(headings, [...guide.matchAll(/^## (.+)$/gm)].map(([, h]) => h).slice(0, -1));
  assert.ok(headings.includes("5 · Actions, and the endpoints behind them"));
});

test("a section left out on purpose does not arrive", () => {
  assert.ok(guide.includes("\n## Integrations\n"));
  assert.ok(!skillFromAuthoring(guide).includes("\n## Integrations\n"));
});

test("links to the guide's neighbours become links to the repository", () => {
  const skill = skillFromAuthoring(guide);

  assert.ok(skill.includes("](https://github.com/repanel-ai/repanel/blob/main/docs/SIGNING.md)"));
  assert.ok(!skill.includes("](SIGNING.md)"));
});

test("a section the rulings do not mention stops the build", () => {
  const grown = `${guide}\n## Widgets\n\nA section nobody ruled on.\n`;

  assert.throws(() => skillFromAuthoring(grown), {
    message: /no ruling on:\n {2}## Widgets/,
  });
});

test("a ruling about a section the guide no longer has stops the build", () => {
  const shrunk = guide.slice(0, guide.indexOf("\n## Platforms\n"));

  assert.throws(() => skillFromAuthoring(shrunk), {
    message: /no longer has:\n {2}## Platforms\n {2}## Integrations/,
  });
});
