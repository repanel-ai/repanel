/** One problem with a definition, written so a coding agent can act on it. */
export interface ValidationError {
  /** JSON path to the problem, e.g. `resources[2].views.table.columns[0]`. */
  path: string;
  /** What is wrong. */
  message: string;
  /** What would be valid, as a noun phrase. */
  expected: string;
  /** A concrete suggested fix. */
  hint: string;
}

/** Path rendered for a problem with the definition as a whole. */
export const ROOT_PATH = "(root)";

export function formatPath(segments: ReadonlyArray<PropertyKey>): string {
  if (segments.length === 0) return ROOT_PATH;
  let path = "";
  for (const segment of segments) {
    if (typeof segment === "number") path += `[${segment}]`;
    else path = path === "" ? String(segment) : `${path}.${String(segment)}`;
  }
  return path;
}

/**
 * Renders the candidates an error offers. Never truncated: a hint that hides
 * an option hides the answer.
 */
export function formatList(values: readonly unknown[]): string {
  if (values.length === 0) return "(none)";
  return values.map((value) => (typeof value === "string" ? value : String(value))).join(", ");
}
