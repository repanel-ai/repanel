import {
  refuseWriteTo,
  type Field,
  type JsonValue,
  type RecordId,
  type Resource,
  type ValidationError,
  type WriteMode,
} from "@repanel/contracts";
import { ValidationFailedError } from "../errors.js";
import { ROW_ALIAS, selectFields, type SelectEntry } from "./columns.js";
import { identityField } from "./fields.js";
import { quoteIdentifier } from "./identifier.js";
import { Parameters } from "./parameters.js";
import type { Query } from "./query-builder.js";

/** One column a write sets, and what to put in it. */
export interface Assignment {
  field: Field;
  value: JsonValue;
}

/** What the modifying half of the statement answers under. */
const WRITTEN_ROW = "w";

/** Said to a person, once, however many fields were wrong. */
export const WRITE_REFUSED = "This record could not be saved.";

/**
 * A write and the record it leaves behind, in one statement.
 *
 * The insert or the update runs inside a data-modifying CTE and the row it
 * returns is selected out of it — which is what lets the record come back
 * through the same select list every read uses. Sensitive columns are not
 * returned even into the CTE, hidden ones are (a form is a detail surface, and
 * so is what it answers with), and a relation reads its label off the same left
 * join a detail read would have made. There is one place a select list is built
 * (`columns.ts`) and this does not become a second one.
 *
 * One statement rather than a write followed by a read: there is then no moment
 * between them for somebody else's write to land in, and no transaction to hold
 * open across two round trips.
 */
export function insertStatement(
  resources: ReadonlyMap<string, Resource>,
  resource: Resource,
  assignments: readonly Assignment[],
): Query {
  return statement(resources, resource, assignments, "create", (parameters, returning) => {
    const columns = assignments.map(({ field }) => quoteIdentifier(field.key)).join(", ");
    const values = assignments.map(({ value }) => parameters.bind(value)).join(", ");

    return (
      `insert into ${quoteIdentifier(resource.source.table)} (${columns})` +
      ` values (${values}) returning ${returning}`
    );
  });
}

/**
 * The fields a write names, set on the record a key names. Fields it does not
 * name keep what they hold — and so does anything another operator wrote a
 * moment ago, which is the whole of the last-write-wins limitation.
 */
export function updateStatement(
  resources: ReadonlyMap<string, Resource>,
  resource: Resource,
  assignments: readonly Assignment[],
  id: RecordId,
): Query {
  return statement(resources, resource, assignments, "update", (parameters, returning) => {
    const sets = assignments
      .map(({ field, value }) => `${quoteIdentifier(field.key)} = ${parameters.bind(value)}`)
      .join(", ");
    // `set` and `where` name bare columns: postgres refuses a table-qualified
    // target in `set`, which is why the modifying half carries no row alias.
    const identity = quoteIdentifier(identityField(resource).key);

    return (
      `update ${quoteIdentifier(resource.source.table)} set ${sets}` +
      ` where ${identity} = ${parameters.bind(id)} returning ${returning}`
    );
  });
}

function statement(
  resources: ReadonlyMap<string, Resource>,
  resource: Resource,
  assignments: readonly Assignment[],
  mode: WriteMode,
  modify: (parameters: Parameters, returning: string) => string,
): Query {
  refuseUnwritable(resource, assignments, mode);
  // Refuses a sensitive primary key, which would leave the written row with no
  // key to answer under — the same guard every read passes through.
  identityField(resource);

  const selection = selectFields(resource.fields, resources);
  const parameters = new Parameters();
  const modifying = modify(parameters, returningList(selection.entries));
  const joins = selection.joins === "" ? "" : ` ${selection.joins}`;

  return {
    text:
      `with ${quoteIdentifier(WRITTEN_ROW)} as (${modifying})` +
      ` select ${selection.columns} from ${quoteIdentifier(WRITTEN_ROW)} as ${quoteIdentifier(ROW_ALIAS)}${joins}`,
    values: parameters.values(),
    select: selection.entries,
  };
}

/**
 * The columns the modifying half hands out, which are exactly the ones the
 * select above reads: derived from the same entries, so the two cannot drift
 * into a select that names a column the CTE did not return.
 */
function returningList(entries: readonly SelectEntry[]): string {
  return entries
    .filter((entry) => entry.kind === "value")
    .map((entry) => quoteIdentifier(entry.key))
    .join(", ");
}

/**
 * The same question the request was already asked, asked again where the
 * statement is written.
 *
 * A definition that marks a secret editable cannot be submitted today, but one
 * stored before that rule existed can still be served — and this is the wall
 * that stands between it and a write. It refuses with a path and a hint rather
 * than a bare failure, because the caller has to be told which field, and the
 * renderer has to be able to put the sentence under it.
 *
 * The mode is part of the question: a primary key the client issues belongs in
 * an insert and in nothing else, and this is where an update that carried one
 * anyway stops.
 */
function refuseUnwritable(
  resource: Resource,
  assignments: readonly Assignment[],
  mode: WriteMode,
): void {
  if (assignments.length === 0) {
    throw new Error(`a write to \`${resource.key}\` reached the builder with no fields to set`);
  }

  const details = assignments
    .map(({ field }) => refuseWriteTo(resource, field, mode))
    .filter((detail): detail is ValidationError => detail !== undefined);

  if (details.length > 0) throw new ValidationFailedError(WRITE_REFUSED, details);
}
