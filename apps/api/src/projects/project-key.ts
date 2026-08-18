import { randomInt } from "node:crypto";

/** Lowercase alphanumerics only: a key has to survive URLs and hostnames. */
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;

/** Long enough to recognize the project, short enough to read in a URL. */
const SLUG_MAX_LENGTH = 40;

/** What a name of pure punctuation or non-Latin script becomes. */
const SLUG_FALLBACK = "project";

/**
 * The routing identity a project keeps for life: `skyscout-a3k9x2`. The name
 * is only a starting point — it can be anything, and it may later say
 * something else, while the key stays what it was.
 */
export function createProjectKey(name: string): string {
  return `${slugify(name)}-${randomSuffix()}`;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");
  return slug || SLUG_FALLBACK;
}

function randomSuffix(): string {
  let suffix = "";
  for (let drawn = 0; drawn < SUFFIX_LENGTH; drawn += 1) {
    suffix += SUFFIX_ALPHABET.charAt(randomInt(SUFFIX_ALPHABET.length));
  }
  return suffix;
}
