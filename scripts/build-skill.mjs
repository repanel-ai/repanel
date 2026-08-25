/**
 * Writes `skills/repanel/SKILL.md` from `docs/AUTHORING.md`, or proves the
 * committed one is still what the guide says.
 *
 * The artifact is committed rather than built on install, because the whole
 * point of the skill is that someone can copy one file onto their machine
 * without cloning this repository. Committed generated files rot, so CI runs
 * this with `--check` and a guide edited without a regeneration fails there.
 *
 * Usage:
 *   node scripts/build-skill.mjs           regenerate the artifact
 *   node scripts/build-skill.mjs --check   fail if it has drifted from the guide
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { skillFromAuthoring } from "./skill-from-authoring.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const GUIDE = "docs/AUTHORING.md";
const SKILL = "skills/repanel/SKILL.md";

const skill = skillFromAuthoring(await readFile(path.join(repoRoot, GUIDE), "utf8"));
const committed = await readFile(path.join(repoRoot, SKILL), "utf8").catch(() => null);

if (!process.argv.includes("--check")) {
  await writeFile(path.join(repoRoot, SKILL), skill);
  console.log(
    committed === skill
      ? `${SKILL} was already current.`
      : `Wrote ${SKILL} from ${GUIDE} (${skill.split("\n").length} lines).`,
  );
} else if (committed === skill) {
  console.log(`${SKILL} is exactly what ${GUIDE} says.`);
} else {
  console.error(
    `${SKILL} is not what ${GUIDE} generates — ` +
      (committed === null ? "it is missing entirely.\n" : "the two have drifted apart.\n") +
      `\n  The guide is the source and the skill is its artifact, so the fix is never to` +
      `\n  edit ${SKILL} by hand:\n` +
      `\n      pnpm skill\n` +
      `\n  Commit what that writes.`,
  );
  process.exit(1);
}
