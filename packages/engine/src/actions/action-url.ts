import type { HttpCallAction, RecordValue, Resource } from "@repanel/contracts";
import { InvalidQueryError, UnservableResourceError } from "../errors.js";

/** `{field_key}` — the only thing a v0 URL template can say. */
const PLACEHOLDER = /\{([^}]*)\}/g;

/**
 * The URL an `httpCall` action will actually request: the definition's template
 * with each `{field_key}` replaced by that field's value on **this** record.
 *
 * The values come from a record the API read for itself. Nothing the browser
 * sent contributes to the address — a client that could choose the field or the
 * value would be choosing the request, and the signature would then be RePanel
 * vouching for whatever it had been handed.
 *
 * Every value is percent-encoded, so a reference carrying a slash, a space or a
 * `?` cannot re-point the URL at a route the definition did not name.
 */
export function resolveActionUrl(
  resource: Resource,
  action: HttpCallAction,
  values: Readonly<Record<string, RecordValue>>,
): string {
  return action.url.replace(PLACEHOLDER, (_match: string, key: string) =>
    encodeURIComponent(fill(resource, action, key, values)),
  );
}

function fill(
  resource: Resource,
  action: HttpCallAction,
  key: string,
  values: Readonly<Record<string, RecordValue>>,
): string {
  const field = resource.fields.find((candidate) => candidate.key === key);

  // Both of these are refused at validation, so a definition that reaches here
  // with one predates the rule. They are refused again because the alternative
  // is worse than a refusal: an unknown field and a sensitive one both resolve
  // to nothing, and a URL with a hole in it addresses some other route
  // entirely (DECISIONS #014).
  if (!field) {
    throw new UnservableResourceError(
      `Action \`${action.key}\` cannot run: its URL names \`${key}\`, which is not a field of \`${resource.key}\`.`,
    );
  }
  if (field.sensitive) {
    throw new UnservableResourceError(
      `Action \`${action.key}\` cannot run: its URL interpolates \`${key}\`, which is marked sensitive.`,
    );
  }

  const value = readable(values[key]);
  if (value === undefined) {
    // Not a definition problem and not a failure of the application's: this
    // record has nothing to put there, so this is not an action it can answer.
    // An empty segment would send the request to a different address and then
    // call whatever came back success.
    throw new InvalidQueryError(
      `Action \`${action.label}\` needs a value for \`${key}\`, and this ${resource.label.singular.toLowerCase()} has none.`,
    );
  }

  return value;
}

/**
 * The one reading a value has in a URL, or nothing.
 *
 * A relation is its key: the field's value carries the record it points at and
 * the label a human reads, and an address is built from the key. A `json` value
 * has no single reading — the same reason it cannot be a `labelField` — and a
 * value that is absent is absent.
 */
function readable(value: RecordValue | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return undefined;

  const relation = value as { id?: unknown; label?: unknown };
  if (!("id" in relation) || !("label" in relation)) return undefined;
  return relation.id === null || relation.id === undefined ? undefined : String(relation.id);
}
