import { formatList, type ValidationError } from "./errors.js";
import type { Definition, Resource } from "./schema.js";

/**
 * Navigation and resources must line up exactly: every entry names a resource
 * that exists, and every resource is named by one entry.
 *
 * The sidebar is built from the groups and from nothing else, so a resource no
 * group lists is offered nowhere. It validates, it is stored, it is served, and
 * an operator opening the admin is never shown that it is there — the silent
 * degradation #008 has no answer for (DECISIONS #027). A resource two groups
 * list is the mirror image: two entries onto one page, both of them lit
 * whenever either is.
 */
export function checkNavigation(
  definition: Definition,
  resources: ReadonlyMap<string, Resource>,
  resourceKeys: readonly string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  /** Where each resource is first listed, so a repeat can point at the original. */
  const listedAt = new Map<string, string>();

  definition.navigation.forEach((group, groupIndex) => {
    group.resources.forEach((key, keyIndex) => {
      const path = `navigation[${groupIndex}].resources[${keyIndex}]`;

      // An entry that names nothing is that one problem, and only that one:
      // reporting it again as a repeat describes the same typo twice.
      if (!resources.has(key)) {
        errors.push({
          path,
          message: `Navigation references unknown resource \`${key}\`.`,
          expected: "a key of a resource defined in `resources`",
          hint: `Change \`${path}\` to one of: ${formatList(resourceKeys)}.`,
        });
        return;
      }

      const first = listedAt.get(key);
      if (first === undefined) {
        listedAt.set(key, path);
        return;
      }

      errors.push({
        path,
        message: `Navigation lists resource \`${key}\` more than once.`,
        expected: "a resource key listed once in `navigation`",
        hint: `Remove \`${path}\`; \`${key}\` is already listed at \`${first}\`, and one resource is one entry in the sidebar.`,
      });
    });
  });

  definition.resources.forEach((resource, index) => {
    if (listedAt.has(resource.key)) return;
    // A key claimed twice resolves to the first entry that claimed it; the rest
    // are duplicates, already reported as such. Telling one of them it is also
    // unlisted is a second error for a resource that does not exist.
    if (resources.get(resource.key) !== resource) return;

    errors.push({
      path: `resources[${index}]`,
      message: `Resource \`${resource.key}\` is defined but no navigation group lists it.`,
      expected: "a resource listed once in `navigation`",
      hint: `Add \`${resource.key}\` to a \`navigation\` group's \`resources\`, or remove \`resources[${index}]\` if the admin should not offer it at all; the sidebar is built from \`navigation\` alone, so an unlisted resource has no entry of its own.`,
    });
  });

  return errors;
}
