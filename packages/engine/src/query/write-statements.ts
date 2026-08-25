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
import { ROW_ALIAS, selectFields, selectValues, type SelectEntry } from "./columns.js";
import { identityField } from "./fields.js";
import { column, quoteIdentifier } from "./identifier.js";
import { Parameters } from "./parameters.js";
import type { Query } from "./query-builder.js";

/** One column a write sets, and what to put in it. */
export interface Assignment {
  field: Field;
  value: JsonValue;
}

/** What the modifying half of the statement answers under. */
export const WRITTEN_ROW = "w";

/**
 * What the row as it stood answers under, and the space its columns are aliased
 * in — `b0`, `b1`, … beside the write's own `c0`, `c1`, … so one row can carry
 * both readings of the same record without either standing in for the other.
 */
export const BEFORE_ROW = "b";

/** Said to a person, once, however many fields were wrong. */
export const WRITE_REFUSED = "This record could not be saved.";

/** A write's own row as it stood before it, read in the same snapshot. */
interface BeforeRead {
  /** The CTE's body. */
  text: string;
  /** What the outer select reads out of it. */
  columns: string;
  entries: SelectEntry[];
}

/** The modifying half of a statement, and — for an update — what it replaced. */
interface Modification {
  text: string;
  before?: BeforeRead;
}

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

    // A record that is being made held nothing a moment ago, so there is no
    // reading of it to take and no CTE here to take one with.
    return {
      text:
        `insert into ${quoteIdentifier(resource.source.table)} (${columns})` +
        ` values (${values}) returning ${returning}`,
    };
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
    // Bound once and named twice. The row the update matches and the row read
    // beside it have to be the same row, and two placeholders would be two
    // chances for them not to be.
    const key = parameters.bind(id);

    return {
      text:
        `update ${quoteIdentifier(resource.source.table)} set ${sets}` +
        ` where ${identity} = ${key} returning ${returning}`,
      before: beforeRead(resource, assignments, key),
    };
  });
}

/**
 * The columns a write is about to set, as they still stand.
 *
 * A CTE beside the update rather than a read before it. Every part of one
 * statement runs against one snapshot and none of them can see another's
 * effects, so what this selects is exactly what the update replaced — with no
 * second round trip, and no moment in between for somebody else's write to land
 * in (DECISIONS #056). The outer select puts the two readings on one line with a
 * `cross join`; when the key names no row both halves are empty and the
 * statement answers with nothing, which is the answer an update that matched
 * nothing already gave.
 *
 * It reads the columns the write names and no others. An audit record is about
 * what changed, and a statement that read the whole row to file two of its
 * columns would be selecting a customer's data to throw it away.
 */
function beforeRead(
  resource: Resource,
  assignments: readonly Assignment[],
  key: string,
): BeforeRead | undefined {
  const selection = selectValues(
    assignments.map(({ field }) => field),
    BEFORE_ROW,
  );
  // Only reachable for a write of nothing but sensitive columns, which is
  // refused above. A select list with no columns in it is not valid SQL, and
  // this is the guard that keeps that from being the way we find out.
  if (selection.entries.length === 0) return undefined;

  return {
    text:
      `select ${selection.columns}` +
      ` from ${quoteIdentifier(resource.source.table)} as ${quoteIdentifier(ROW_ALIAS)}` +
      ` where ${column(ROW_ALIAS, identityField(resource).key)} = ${key}`,
    columns: selection.entries
      .map((entry) => `${column(BEFORE_ROW, entry.alias)} as ${quoteIdentifier(entry.alias)}`)
      .join(", "),
    entries: selection.entries,
  };
}

function statement(
  resources: ReadonlyMap<string, Resource>,
  resource: Resource,
  assignments: readonly Assignment[],
  mode: WriteMode,
  modify: (parameters: Parameters, returning: string) => Modification,
): Query {
  refuseUnwritable(resource, assignments, mode);
  // Refuses a sensitive primary key, which would leave the written row with no
  // key to answer under — the same guard every read passes through.
  identityField(resource);

  const selection = selectFields(resource.fields, resources);
  const parameters = new Parameters();
  const modifying = modify(parameters, returningList(selection.entries));
  const joins = selection.joins === "" ? "" : ` ${selection.joins}`;
  const { before } = modifying;

  const read = before ? `${quoteIdentifier(BEFORE_ROW)} as (${before.text}), ` : "";
  const columns = before ? `${selection.columns}, ${before.columns}` : selection.columns;
  const paired = before ? ` cross join ${quoteIdentifier(BEFORE_ROW)}` : "";

  return {
    text:
      `with ${read}${quoteIdentifier(WRITTEN_ROW)} as (${modifying.text})` +
      ` select ${columns} from ${quoteIdentifier(WRITTEN_ROW)} as ${quoteIdentifier(ROW_ALIAS)}${joins}${paired}`,
    values: parameters.values(),
    select: selection.entries,
    ...(before ? { before: before.entries } : {}),
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
