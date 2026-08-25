import {
  listRecordsQuerySchema,
  optionsQuerySchema,
  type ListRecordsQuery,
  type OptionsQuery,
} from "@repanel/contracts";

/** `filter[status]`, or `filter[created_at][from]` — the two shapes a table asks in. */
const FILTER_PARAM = /^filter\[([^\]]+)\](?:\[(from|to)\])?$/;

/** A query string that does not describe a page of records. */
export class UnreadableQueryError extends Error {}

/**
 * A record list's question, read off a query string.
 *
 * The hosted API is served by Express, which nests `filter[status]=active` into
 * an object before the schema ever sees it; `URLSearchParams` does not, so the
 * two bracket shapes the runtime's table writes are rebuilt here — and nothing
 * else is. A parameter in any other shape is left under the key it arrived as,
 * which is what makes the strict schema refuse a typo instead of quietly
 * answering it with the first page of everything.
 */
export function readListQuery(params: URLSearchParams): ListRecordsQuery {
  const asked: Record<string, unknown> = {};
  const filter: Record<string, unknown> = {};

  for (const [key, value] of params) {
    const match = FILTER_PARAM.exec(key);
    if (!match) {
      asked[key] = repeated(asked[key], value);
      continue;
    }

    const [, field = "", end] = match;
    if (end === undefined) {
      filter[field] = repeated(filter[field], value);
      continue;
    }

    const range = isRange(filter[field]) ? (filter[field] as Record<string, unknown>) : {};
    filter[field] = { ...range, [end]: repeated(range[end], value) };
  }

  if (Object.keys(filter).length > 0) asked.filter = filter;

  const parsed = listRecordsQuerySchema.safeParse(asked);
  if (!parsed.success) {
    // Every offending parameter at once, named — the same sentence the hosted
    // API's validation pipe builds, for the same reason: one round trip per fix
    // is one too many.
    throw new UnreadableQueryError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; "),
    );
  }
  return parsed.data;
}

/**
 * A parameter given twice becomes both values, which is what the hosted API's
 * query parser does with it — and then the strict schema refuses it there and
 * here alike. Last-one-wins would answer a contradictory address instead of
 * saying it was contradictory.
 */
function repeated(existing: unknown, value: string): unknown {
  if (existing === undefined) return value;
  return Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function isRange(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * What a picker is asking, read off the same query string. There is nothing to
 * rebuild here — a box holds one value — so this is the schema and the same
 * refusal, said the same way.
 */
export function readOptionsQuery(params: URLSearchParams): OptionsQuery {
  const asked: Record<string, unknown> = {};
  for (const [key, value] of params) asked[key] = repeated(asked[key], value);

  const parsed = optionsQuerySchema.safeParse(asked);
  if (!parsed.success) {
    throw new UnreadableQueryError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; "),
    );
  }
  return parsed.data;
}
