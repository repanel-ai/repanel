/**
 * Turns `docs/AUTHORING.md` into the body of an installable agent skill.
 *
 * The guide is the single source. A skill is a copy of it that lives somewhere
 * else — a `~/.claude/skills` directory, someone's `AGENTS.md` — and a copy
 * that can be edited on its own is a copy that will disagree with the guide
 * within a release. So this generates the whole artifact, `build-skill.mjs`
 * writes it, and CI regenerates it and compares bytes.
 *
 * Byte-equality alone would not catch the failure that matters, though: a
 * generator that silently dropped a section would still agree with the file it
 * had generated. That is what the rulings below are for. Every top-level
 * section of the guide is either carried or deliberately left out, by name, and
 * a section this file has no ruling on stops the build. A new section is then a
 * decision someone has to make rather than content that quietly never ships.
 */

/** Says where the artifact came from, to whoever opens it looking for the source. */
const BANNER = "<!-- Generated from docs/AUTHORING.md. Edit that, then run `pnpm skill`. -->";

/** Where the guide's relative links have to point once the skill is elsewhere. */
const SOURCE_URL = "https://github.com/repanel-ai/repanel/blob/main/docs";

/**
 * The trigger: what an agent reads to decide whether to load the body. It is
 * packaging rather than guidance, so it is written here rather than in the
 * guide, which has no reason to describe when it should be read.
 */
const FRONT_MATTER = {
  name: "repanel",
  description:
    "Author, submit and repair a RePanel admin definition for a customer's application — " +
    "how to read a schema into resources, which columns are sensitive and which are merely " +
    "hidden, when an action needs an endpoint in the application rather than a direct write, " +
    "and how to run the admin locally with repanel dev. Use when a repository has a repanel/ " +
    "directory, when the repanel MCP tools are connected, or when asked to build, extend or " +
    "repair a RePanel admin.",
};

/** The sections the skill carries, named exactly as the guide heads them. */
const CARRIED = [
  "The loop",
  "1 · Inspect the application",
  "2 · Connect — and never touch a secret",
  "3 · Where the definition lives",
  "4 · Classify every column",
  "5 · Actions, and the endpoints behind them",
  "6 · Submit and repair",
  "7 · Work locally, before any of that",
  "Platforms",
];

/** The sections deliberately left out, each with the reason it is left out. */
const LEFT_OUT = {
  Integrations: "reserved for post-MVP recipes — it has nothing to teach yet",
};

/**
 * The skill file, front matter and all, for a given `docs/AUTHORING.md`.
 * Throws when the guide and the rulings above have drifted apart.
 */
export function skillFromAuthoring(authoring) {
  const { preamble, sections } = splitSections(authoring);
  requireARulingPerSection(sections);

  const carried = sections.filter((section) => CARRIED.includes(section.title));
  const body = [preamble, ...carried.map((section) => section.text)].join("");

  return `${frontMatter()}\n${BANNER}\n\n${linkToSource(body).trim()}\n`;
}

/**
 * The text before the first `##`, then one entry per section. Each heading line
 * stays inside its own text, so a carried section is emitted verbatim.
 */
function splitSections(markdown) {
  const [preamble, ...rest] = markdown.split(/^(?=## )/m);
  return {
    preamble,
    sections: rest.map((text) => ({ title: text.slice(3, text.indexOf("\n")).trim(), text })),
  };
}

/** Every section is carried or left out by name, and every name is a section. */
function requireARulingPerSection(sections) {
  const present = sections.map((section) => section.title);
  const ruled = [...CARRIED, ...Object.keys(LEFT_OUT)];

  const unruled = present.filter((title) => !ruled.includes(title));
  if (unruled.length > 0) {
    throw new Error(
      `docs/AUTHORING.md has ${unruled.length} section(s) this skill has no ruling on:\n` +
        unruled.map((title) => `  ## ${title}`).join("\n") +
        `\nAdd each to CARRIED or to LEFT_OUT with a reason, in ` +
        `scripts/skill-from-authoring.mjs. A section with no ruling would ship nowhere.`,
    );
  }

  const stale = ruled.filter((title) => !present.includes(title));
  if (stale.length > 0) {
    throw new Error(
      `This skill rules on ${stale.length} section(s) docs/AUTHORING.md no longer has:\n` +
        stale.map((title) => `  ## ${title}`).join("\n") +
        `\nThey were renamed or removed. Update CARRIED or LEFT_OUT to match the guide.`,
    );
  }
}

/**
 * The guide links to its neighbours in `docs/`; the skill is read from a
 * machine that has neither, so those become links to the repository.
 */
function linkToSource(markdown) {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (link, target) =>
    /^(?:[a-z][a-z0-9+.-]*:|[#/])/i.test(target) ? link : `](${SOURCE_URL}/${target})`,
  );
}

/** YAML, but only ever these two scalars, so it is written rather than serialized. */
function frontMatter() {
  return `---\nname: ${FRONT_MATTER.name}\ndescription: ${FRONT_MATTER.description}\n---\n`;
}
