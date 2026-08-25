/**
 * The order resource files are composed in: the order the navigation names
 * them, then everything it does not mention, by key.
 *
 * Composition order is a contract, not a detail. Problems are reported at
 * paths like `resources[2].fields[0]`, and an index that means a different
 * resource on the next run is an index nobody can act on (AUTHORING.md §3).
 */
export function orderResourceKeys(
  navigationOrder: readonly string[],
  available: readonly string[],
): string[] {
  const listed = navigationOrder.filter((key) => available.includes(key));
  const unlisted = available.filter((key) => !listed.includes(key)).sort();
  return [...listed, ...unlisted];
}

/**
 * The resource keys the navigation names, in order, first mention winning.
 *
 * Read defensively: the app file has not been validated yet, and a navigation
 * that is malformed is the validator's problem to report, not a reason to
 * refuse to assemble the definition it would report on.
 */
export function navigationOrder(app: Record<string, unknown>): string[] {
  const groups = Array.isArray(app.navigation) ? app.navigation : [];
  const keys = new Set<string>();
  for (const group of groups) {
    if (group === null || typeof group !== "object") continue;
    const resources = (group as { resources?: unknown }).resources;
    if (!Array.isArray(resources)) continue;
    for (const key of resources) if (typeof key === "string") keys.add(key);
  }
  return [...keys];
}
