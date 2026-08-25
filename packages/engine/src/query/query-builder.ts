import {
  formatList,
  type ActionValue,
  type Field,
  type ListRecordsQuery,
  type RecordId,
  type Resource,
} from "@repanel/contracts";
import { InvalidQueryError, UnservableResourceError } from "../errors.js";
import { ROW_ALIAS, selectFields, type SelectEntry } from "./columns.js";
import { filterConditions, searchCondition } from "./conditions.js";
import { identityField, indexFields, listFields } from "./fields.js";
import { column, quoteIdentifier } from "./identifier.js";
import { Parameters } from "./parameters.js";
import { insertStatement, updateStatement, type Assignment } from "./write-statements.js";

/** A statement, what to send with it, and how to read what comes back. */
export interface Query {
  text: string;
  values: unknown[];
  select: SelectEntry[];
}

/** A page of records, and the count that says how many there are to page. */
export interface RecordsQuery {
  rows: Query;
  total: Query;
}

/** Narrows a page to the records belonging to one record of another resource. */
export interface Ownership {
  field: Field;
  id: RecordId;
}

/** What the count answers under, and what a single-column lookup answers under. */
export const TOTAL_ALIAS = "total";
export const LOOKUP_ALIAS = "c0";

/**
 * Turns a validated definition and a request into parameterized SQL. Nothing
 * here reaches a database, a network or a clock: given the same definition and
 * the same request it writes the same statement, which is what makes the rules
 * of DECISIONS #024 testable rather than reviewable.
 *
 * Every identifier it writes was read out of the definition and passed through
 * `quoteIdentifier`; every value the caller supplied was passed through
 * `Parameters`. A request never contributes an identifier — it contributes a
 * key, which is looked up, and what gets written is the definition's own copy.
 */
export class QueryBuilder {
  /**
   * A page of a resource's records. `owner` narrows it to the records that
   * belong to one record elsewhere, which is the whole of what makes a related
   * list different from a list.
   */
  records(
    resources: ReadonlyMap<string, Resource>,
    resource: Resource,
    query: ListRecordsQuery,
    owner?: Ownership,
  ): RecordsQuery {
    // Narrowing is probing: whoever gets a page back learns which records
    // carry the value they supplied, and a count comes back even when the page
    // is empty. `lookup` refuses a sensitive column on the other side of the
    // same traversal, and a rule that holds on one side only is not one.
    if (owner?.field.sensitive) {
      throw new UnservableResourceError(
        `Resource \`${resource.key}\` cannot be narrowed by \`${owner.field.key}\`: the field is marked sensitive.`,
      );
    }

    const fields = indexFields(resource);
    const selection = selectFields(listFields(resource), resources);
    const parameters = new Parameters();

    const conditions: string[] = [];
    if (owner) conditions.push(`${column(ROW_ALIAS, owner.field.key)} = ${parameters.bind(owner.id)}`);
    if (query.search !== undefined) {
      conditions.push(searchCondition(resource, query.search, fields, parameters));
    }
    if (query.filter) conditions.push(...filterConditions(resource, query.filter, fields, parameters));

    // The count is the same question over the same rows, so it shares the
    // conditions and the values bound for them — and stops there, which is why
    // reading its values before the page's limit is bound is deliberate.
    const countValues = parameters.values();
    const limit = parameters.bind(query.pageSize);
    const offset = parameters.bind((query.page - 1) * query.pageSize);

    const source = `from ${from(resource)}`;
    const joins = selection.joins === "" ? "" : ` ${selection.joins}`;

    return {
      rows: {
        text:
          `select ${selection.columns} ${source}${joins}${where(conditions)}` +
          ` ${orderBy(resource, query, fields)} limit ${limit} offset ${offset}`,
        values: parameters.values(),
        select: selection.entries,
      },
      total: {
        // No joins: nothing that narrows a page reads a joined column, so the
        // count has no reason to pay for one.
        text: `select count(*) as ${quoteIdentifier(TOTAL_ALIAS)} ${source}${where(conditions)}`,
        values: countValues,
        select: [],
      },
    };
  }

  /**
   * One record, in full. Hidden fields are here and absent from a list — that
   * is the whole of what `hidden` means. Sensitive ones are in neither.
   */
  record(
    resources: ReadonlyMap<string, Resource>,
    resource: Resource,
    id: RecordId,
  ): Query {
    const selection = selectFields(resource.fields, resources);
    const parameters = new Parameters();
    const joins = selection.joins === "" ? "" : ` ${selection.joins}`;
    const identity = identityField(resource);

    return {
      text:
        `select ${selection.columns} from ${from(resource)}${joins}` +
        ` where ${column(ROW_ALIAS, identity.key)} = ${parameters.bind(id)} limit 1`,
      values: parameters.values(),
      select: selection.entries,
    };
  }

  /**
   * One column of one record, answered under `c0`. It is what a related list
   * needs before it can read anything: whether the record it hangs off exists,
   * and — for a `belongsTo` — which record that one points at.
   *
   * The value is bound into the next query and never returned, but a sensitive
   * column is still refused: "never selected" is a rule about SELECT lists, and
   * a rule with an exception in it is not one this module can be checked against.
   */
  lookup(resource: Resource, id: RecordId, field: Field): Query {
    if (field.sensitive) {
      throw new UnservableResourceError(
        `Resource \`${resource.key}\` cannot be traversed by \`${field.key}\`: the field is marked sensitive.`,
      );
    }

    const parameters = new Parameters();
    const identity = identityField(resource);

    return {
      text:
        `select ${column(ROW_ALIAS, field.key)} as ${quoteIdentifier(LOOKUP_ALIAS)} from ${from(resource)}` +
        ` where ${column(ROW_ALIAS, identity.key)} = ${parameters.bind(id)} limit 1`,
      values: parameters.values(),
      select: [],
    };
  }

  /**
   * A record made out of what a form carried, answered with the record it
   * became. The columns and the values are the caller's; the table, the
   * quoting and the select list that reads the new row back are not.
   */
  insertRecord(
    resources: ReadonlyMap<string, Resource>,
    resource: Resource,
    assignments: readonly Assignment[],
  ): Query {
    return insertStatement(resources, resource, assignments);
  }

  /** The fields a form changed, written to the record a key names. */
  updateRecord(
    resources: ReadonlyMap<string, Resource>,
    resource: Resource,
    assignments: readonly Assignment[],
    id: RecordId,
  ): Query {
    return updateStatement(resources, resource, assignments, id);
  }

  /**
   * One field of one record set to one literal — what a `dbUpdate` action
   * needs, and nothing a form goes through.
   *
   * It is built here rather than beside the action because the rules of
   * DECISIONS #024 are properties of this file: the table, the column and the
   * key column are the definition's own and quoted, the value and the id are
   * bound, and there is no second place a statement can be assembled. A write
   * that went around it would be a write nothing had checked.
   *
   * `set` names a bare column: Postgres refuses a table-qualified target there,
   * which is why this statement has no row alias.
   */
  setField(resource: Resource, field: Field, value: ActionValue, id: RecordId): Query {
    // Validation refuses a `dbUpdate` on a sensitive field; this is that rule
    // standing where the statement is written, for a definition stored before
    // it existed. `hidden` is deliberately not refused — hidden is a display
    // choice and sensitive is a security one, and the two must not blur
    // (DECISIONS #014).
    if (field.sensitive) {
      throw new UnservableResourceError(
        `Resource \`${resource.key}\` cannot be written through \`${field.key}\`: the field is marked sensitive.`,
      );
    }

    const identity = identityField(resource);
    const parameters = new Parameters();

    return {
      text:
        `update ${quoteIdentifier(resource.source.table)} set ${quoteIdentifier(field.key)} = ${parameters.bind(value)}` +
        ` where ${quoteIdentifier(identity.key)} = ${parameters.bind(id)}`,
      values: parameters.values(),
      select: [],
    };
  }
}

function from(resource: Resource): string {
  return `${quoteIdentifier(resource.source.table)} as ${quoteIdentifier(ROW_ALIAS)}`;
}

function where(conditions: readonly string[]): string {
  return conditions.length === 0 ? "" : ` where ${conditions.join(" and ")}`;
}

interface Sort {
  field: Field;
  direction: "asc" | "desc";
}

function orderBy(
  resource: Resource,
  query: ListRecordsQuery,
  fields: ReadonlyMap<string, Field>,
): string {
  const identity = identityField(resource);
  const sorted = sortField(resource, query, fields);
  const terms: string[] = [];

  if (sorted) terms.push(`${column(ROW_ALIAS, sorted.field.key)} ${sorted.direction}`);
  // Records that tie on the sort column are otherwise free to swap places
  // between one query and the next, and a page boundary is exactly where that
  // shows one record twice and another not at all.
  if (sorted?.field.key !== identity.key) terms.push(`${column(ROW_ALIAS, identity.key)} asc`);

  return `order by ${terms.join(", ")}`;
}

function sortField(
  resource: Resource,
  query: ListRecordsQuery,
  fields: ReadonlyMap<string, Field>,
): Sort | undefined {
  if (query.sort !== undefined) {
    const field = fields.get(query.sort);
    if (!field || field.sensitive || field.hidden) {
      throw new InvalidQueryError(
        `Cannot sort resource \`${resource.key}\` by \`${query.sort}\`. Sortable fields: ${formatList(sortableKeys(fields))}.`,
      );
    }
    return { field, direction: query.direction ?? "asc" };
  }

  const { defaultSort } = resource.views.table;
  const field = fields.get(defaultSort.field);
  // The default sort is the definition's choice rather than the caller's, so it
  // can never fail a request. Validation now refuses a sensitive one outright,
  // so nothing an agent submits reaches here; a definition stored before that
  // rule existed still can, and for it a dropped sort with the primary key
  // below carrying the ordering beats a resource nobody can list at all.
  if (!field || field.sensitive) return undefined;

  return { field, direction: query.direction ?? defaultSort.direction };
}

function sortableKeys(fields: ReadonlyMap<string, Field>): string[] {
  return [...fields.values()].filter((field) => !field.sensitive && !field.hidden).map((field) => field.key);
}
