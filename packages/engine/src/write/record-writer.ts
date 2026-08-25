import {
  checkRecordValues,
  formatList,
  type Field,
  type JsonValue,
  type RecordDto,
  type RecordId,
  type RecordWrite,
  type Resource,
  type ValidationError,
  type WriteMode,
} from "@repanel/contracts";
import type { QueryResult } from "pg";
import {
  ConflictError,
  NotFoundError,
  QueryTimeoutError,
  ValidationFailedError,
  WriteRefusedError,
} from "../errors.js";
import { QueryBuilder, type Query } from "../query/query-builder.js";
import { WRITE_REFUSED, type Assignment } from "../query/write-statements.js";
import type { ReadContext } from "../read/record-reader.js";
import { toRecordDtos } from "../read/records.mapper.js";
import { requireResource } from "../resources.js";

/** The customer's database ran out of the time the pool gave the statement. */
const STATEMENT_TIMEOUT = "57014";

/**
 * The integrity failures a write can raise that mean something to the person
 * who filled the form in, as opposed to something to us. Each is the database
 * being the authority on a rule the definition cannot state (DECISIONS #016).
 */
const UNIQUE_VIOLATION = "23505";
const NOT_NULL_VIOLATION = "23502";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

/** Class 22: a value the column cannot hold, whatever our own checks made of it. */
const DATA_EXCEPTION = "22";

/** What a write is, once the resource and the values behind it are resolved. */
type WritePlan =
  | { mode: "create"; resource: Resource; values: Readonly<Record<string, JsonValue>> }
  | {
      mode: "update";
      resource: Resource;
      values: Readonly<Record<string, JsonValue>>;
      id: RecordId;
    };

/**
 * Writes a customer's records on behalf of the admin a definition describes.
 *
 * It sits beside the reader rather than inside it, because the reader's
 * guarantee is that it never writes. What it shares it shares deliberately: the
 * statement comes from the same builder and the row comes back through the same
 * mapper, so a record that was just written reads exactly like one that was
 * just fetched.
 *
 * Creating and updating converge on `perform`, which is the only place in this
 * engine where a form's values reach a database. That is on purpose: one seam
 * to wrap when writes have to be recorded as well as made.
 */
export class RecordWriter {
  constructor(private readonly queries: QueryBuilder) {}

  async createRecord(
    context: ReadContext,
    resourceKey: string,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const resource = requireResource(context.resources, resourceKey);

    return this.perform(context, { mode: "create", resource, values: write.values });
  }

  async updateRecord(
    context: ReadContext,
    resourceKey: string,
    id: RecordId,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const resource = requireResource(context.resources, resourceKey);

    return this.perform(context, { mode: "update", resource, values: write.values, id });
  }

  /**
   * The one write. Everything that decides whether it may happen is above the
   * statement: the resource offers this write, the values are ones its fields
   * can hold, and the fields are ones the definition opened. What comes back is
   * the record as it now stands, read out of the same statement that wrote it.
   */
  private async perform(context: ReadContext, plan: WritePlan): Promise<RecordDto> {
    const { resource, mode } = plan;

    if (!offers(resource, mode)) {
      throw new WriteRefusedError(
        `Resource \`${resource.key}\` does not accept ${mode === "create" ? "new records" : "changes"}. ${describeWrites(resource)}`,
      );
    }

    const problems = checkRecordValues(resource, mode, plan.values);
    if (problems.length > 0) throw new ValidationFailedError(WRITE_REFUSED, problems);

    const assignments = assignmentsFor(resource, plan.values);
    const query =
      plan.mode === "create"
        ? this.queries.insertRecord(context.resources, resource, assignments)
        : this.queries.updateRecord(context.resources, resource, assignments, plan.id);

    const result = await this.execute(context, query, assignments);
    const [record] = toRecordDtos(result, query.select, resource.primaryKey);

    if (!record) {
      // An update that matched nothing is a record that is not there. An insert
      // that returned nothing cannot happen, and saying so plainly beats
      // answering a successful write with "not found".
      if (plan.mode === "update") throw new NotFoundError("Record not found");
      throw new Error(`the insert into \`${resource.key}\` returned no row`);
    }

    return record;
  }

  /**
   * Runs the write against the customer's database. What comes back from a
   * failure is a category and, where the database named the column, a path the
   * renderer can put the sentence under — never the driver's words, which name
   * hosts, constraints and the values that were sent.
   */
  private async execute(
    context: ReadContext,
    query: Query,
    assignments: readonly Assignment[],
  ): Promise<QueryResult> {
    const pool = await context.pool();
    try {
      return await pool.query({ text: query.text, values: query.values });
    } catch (error) {
      throw this.translate(error, assignments);
    }
  }

  private translate(error: unknown, assignments: readonly Assignment[]): unknown {
    const failure = error as { code?: unknown; column?: unknown } | null | undefined;
    const code = typeof failure?.code === "string" ? failure.code : "";

    if (code === STATEMENT_TIMEOUT) {
      return new QueryTimeoutError("The database took too long to answer this write.");
    }

    if (code === UNIQUE_VIOLATION) {
      return new ConflictError("Another record already holds one of these values.");
    }

    if (code === NOT_NULL_VIOLATION) {
      const column = typeof failure?.column === "string" ? failure.column : undefined;
      return refusal(
        pathFor(assignments, (field) => field.key === column),
        "This field cannot be empty.",
        "a value",
        "The database requires a value in this column. Fill it in, or give the column a default.",
      );
    }

    if (code === FOREIGN_KEY_VIOLATION) {
      // The database names the constraint rather than the column, so the field
      // is deduced instead: if the write touched exactly one relation, that is
      // the one it could have been. If it touched several, the write as a whole
      // is what gets told.
      return refusal(
        pathFor(assignments, (field) => field.type === "relation"),
        "This points at a record that does not exist.",
        "the key of a record that is there",
        "Pick a record that exists, or clear the field if it may point at nothing.",
      );
    }

    if (code === CHECK_VIOLATION) {
      return refusal(
        undefined,
        "The database refused these values.",
        "values the table's own constraints accept",
        "A rule on this table rejected the write. The rule lives in your application's schema, so the fix does too.",
      );
    }

    if (code.startsWith(DATA_EXCEPTION)) {
      return refusal(
        undefined,
        "A value is not one the column it was written to can hold.",
        "values of the types the fields declare",
        "Check the values against the column types; a definition that declares the wrong type for a column will fail here every time.",
      );
    }

    return error;
  }
}

function offers(resource: Resource, mode: WriteMode): boolean {
  return mode === "create" ? resource.writes.create : resource.writes.update;
}

function describeWrites(resource: Resource): string {
  const offered = [
    ...(resource.writes.create ? ["create"] : []),
    ...(resource.writes.update ? ["update"] : []),
  ];
  return offered.length === 0
    ? "It is read-only."
    : `It offers: ${formatList(offered)}.`;
}

/**
 * The columns to write, in the order the resource declares its fields. The
 * order of a JSON object is the caller's, and a statement whose text depends on
 * it is a statement that cannot be asserted against.
 */
function assignmentsFor(
  resource: Resource,
  values: Readonly<Record<string, JsonValue>>,
): Assignment[] {
  return resource.fields
    .filter((field) => field.key in values)
    .map((field) => ({ field, value: values[field.key] as JsonValue }));
}

/** `values.<field key>` when exactly one field can be meant, and `values` otherwise. */
function pathFor(
  assignments: readonly Assignment[],
  matches: (field: Field) => boolean,
): string | undefined {
  const found = assignments.filter(({ field }) => matches(field));
  return found.length === 1 ? found[0]?.field.key : undefined;
}

function refusal(
  key: string | undefined,
  message: string,
  expected: string,
  hint: string,
): ValidationFailedError {
  const detail: ValidationError = {
    path: key === undefined ? "values" : `values.${key}`,
    message,
    expected,
    hint,
  };
  return new ValidationFailedError(WRITE_REFUSED, [detail]);
}
