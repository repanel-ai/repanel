import {
  formatList,
  type DateRangeFilter,
  type Field,
  type Filter,
  type RecordFilterValue,
  type Resource,
} from "@repanel/contracts";
import { InvalidQueryError } from "../../errors/domain-errors";
import { requireField } from "./fields";
import { ROW_ALIAS } from "./columns";
import { column } from "./identifier";
import type { Parameters } from "./parameters";

/**
 * What narrows a record page: the search box and the filters the table view
 * declares. Every field named here is looked up in the definition, and every
 * value the caller supplied is bound — so a condition is made of identifiers
 * the definition chose and placeholders, and of nothing else.
 */

/** One ILIKE across every field the view says the search box covers. */
export function searchCondition(
  resource: Resource,
  term: string,
  fields: ReadonlyMap<string, Field>,
  parameters: Parameters,
): string {
  const searchable = resource.views.table.search;
  if (searchable.length === 0) {
    throw new InvalidQueryError(
      `Resource \`${resource.key}\` declares no searchable fields, so it cannot be searched.`,
    );
  }

  // One placeholder for every field: the same term is being looked for, and
  // repeating it would only give the planner more to read.
  const placeholder = parameters.bind(`%${escapeLike(term)}%`);
  const matches = searchable.map(
    (key) => `${column(ROW_ALIAS, requireField(fields, key, resource).key)} ilike ${placeholder}`,
  );

  return `(${matches.join(" or ")})`;
}

/** One condition per filter the request carries, in the order it carries them. */
export function filterConditions(
  resource: Resource,
  requested: Readonly<Record<string, RecordFilterValue>>,
  fields: ReadonlyMap<string, Field>,
  parameters: Parameters,
): string[] {
  const declared = new Map(resource.views.table.filters.map((filter) => [filter.field, filter]));

  return Object.entries(requested).flatMap(([key, value]) => {
    const filter = declared.get(key);
    if (!filter) {
      throw new InvalidQueryError(
        `Resource \`${resource.key}\` declares no filter on \`${key}\`. Filterable fields: ${formatList([...declared.keys()])}.`,
      );
    }
    return conditionsFor(filter, requireField(fields, key, resource), value, parameters);
  });
}

function conditionsFor(
  filter: Filter,
  field: Field,
  value: RecordFilterValue,
  parameters: Parameters,
): string[] {
  const at = column(ROW_ALIAS, field.key);

  if (filter.kind === "dateRange") {
    if (typeof value === "string") {
      throw new InvalidQueryError(
        `Filter \`${filter.field}\` is a date range: use filter[${filter.field}][from] and filter[${filter.field}][to].`,
      );
    }
    return dateRangeConditions(at, filter.field, value, parameters);
  }

  const raw = requireSingleValue(filter.field, value);

  if (filter.kind === "enum") {
    // The kind is checked against the field type at validation, so an `enum`
    // filter is bound to an `enum` field or the definition never got here.
    if (field.type !== "enum") throw new Error(`filter on \`${field.key}\` is not bound to an enum field`);
    if (!field.values.includes(raw)) {
      throw new InvalidQueryError(
        `\`${raw}\` is not a value of enum field \`${filter.field}\`. Values: ${formatList(field.values)}.`,
      );
    }
    return [`${at} = ${parameters.bind(raw)}`];
  }

  if (filter.kind === "boolean") {
    if (raw !== "true" && raw !== "false") {
      throw new InvalidQueryError(`Filter \`${filter.field}\` takes \`true\` or \`false\`, not \`${raw}\`.`);
    }
    return [`${at} = ${parameters.bind(raw === "true")}`];
  }

  // `relation`: the key is compared as it arrived, and Postgres decides whether
  // the column's type can read it. A value it cannot is answered as a bad
  // request rather than as a failure of ours.
  return [`${at} = ${parameters.bind(raw)}`];
}

function dateRangeConditions(
  at: string,
  key: string,
  range: DateRangeFilter,
  parameters: Parameters,
): string[] {
  const conditions: string[] = [];
  if (range.from !== undefined) conditions.push(`${at} >= ${parameters.bind(requireDate(key, "from", range.from))}`);
  if (range.to !== undefined) conditions.push(`${at} <= ${parameters.bind(requireDate(key, "to", range.to))}`);

  if (conditions.length === 0) {
    throw new InvalidQueryError(`Filter \`${key}\` needs a \`from\`, a \`to\`, or both.`);
  }
  return conditions;
}

function requireSingleValue(key: string, value: RecordFilterValue): string {
  if (typeof value === "string") return value;
  throw new InvalidQueryError(`Filter \`${key}\` takes a single value, not a range.`);
}

/**
 * Refused here rather than left to the database, so that `from=yesterday` is a
 * request that was not understood instead of a date Postgres would helpfully
 * invent. The text itself is what gets bound: the column decides how to read it.
 */
function requireDate(key: string, end: string, value: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new InvalidQueryError(
      `\`${value}\` is not a date. Filter \`${key}\` takes an ISO 8601 date or timestamp in \`${end}\`.`,
    );
  }
  return value;
}

/** `%`, `_` and the escape character are ours to mean, never the searcher's. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}
