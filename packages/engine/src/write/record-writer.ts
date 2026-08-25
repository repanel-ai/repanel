import {
  checkRecordValues,
  formatList,
  type AuditValues,
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
import type { AuditEvent, WriteContext } from "../audit/audit-event.js";
import { outcomeOf } from "../audit/outcome.js";
import {
  ConflictError,
  NotFoundError,
  QueryTimeoutError,
  ValidationFailedError,
  WriteRefusedError,
} from "../errors.js";
import { QueryBuilder, type Query } from "../query/query-builder.js";
import { WRITE_REFUSED, type Assignment } from "../query/write-statements.js";
import { toFieldValues, toRecordDtos } from "../read/records.mapper.js";
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

/** A write that landed: the record it left, and both readings of what it set. */
interface Written {
  record: RecordDto;
  /** What those same columns held. Null for a create, which replaced nothing. */
  before: AuditValues | null;
  after: AuditValues;
}

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
 * engine where a form's values reach a database — and therefore the one place
 * that has to account for them. Every write leaves an event behind it, whatever
 * it came to (DECISIONS #061).
 */
export class RecordWriter {
  constructor(private readonly queries: QueryBuilder) {}

  async createRecord(
    context: WriteContext,
    resourceKey: string,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const resource = requireResource(context.resources, resourceKey);

    return this.perform(context, { mode: "create", resource, values: write.values });
  }

  async updateRecord(
    context: WriteContext,
    resourceKey: string,
    id: RecordId,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const resource = requireResource(context.resources, resourceKey);

    return this.perform(context, { mode: "update", resource, values: write.values, id });
  }

  /**
   * The write, and the account of it.
   *
   * The event is built out of what the statement actually did, so there is no
   * arrangement of failures under which one claims a success that did not
   * happen: a write that throws reaches the second branch, and nothing else
   * writes an event at all.
   *
   * The success is not returned until the event is filed, and a failure to file
   * one is not swallowed. The two live in different databases — the record in
   * the customer's, the event in RePanel's — so there is no transaction that
   * could hold them together; what stands in for one is that an operator is
   * never told a write succeeded before it has been accounted for (DECISIONS
   * #061).
   */
  private async perform(context: WriteContext, plan: WritePlan): Promise<RecordDto> {
    let written: Written;

    try {
      written = await this.write(context, plan);
    } catch (error) {
      // Best-effort, and deliberately so: nothing reached the customer's
      // database, so nothing is unaccounted for — and a log that could not be
      // written must not replace the answer the caller is owed about their own
      // write. A host that cares logs it on its own side.
      await context.audit(refusalOf(plan, error)).catch(() => undefined);
      throw error;
    }

    await context.audit({
      kind: plan.mode,
      resourceKey: plan.resource.key,
      recordId: written.record.id,
      actionKey: null,
      outcome: "ok",
      reason: null,
      before: written.before,
      after: written.after,
    });

    return written.record;
  }

  /**
   * The one write. Everything that decides whether it may happen is above the
   * statement: the resource offers this write, the values are ones its fields
   * can hold, and the fields are ones the definition opened. What comes back is
   * the record as it now stands, read out of the same statement that wrote it —
   * and, for an update, what the columns it set held a moment before, read out
   * of the same statement's own snapshot.
   */
  private async write(context: WriteContext, plan: WritePlan): Promise<Written> {
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

    // The columns this write named, on both sides of it. A `sensitive` field is
    // in neither: it could not have been assigned (`refuseWriteTo`), and the
    // select lists that answer this statement drop one anyway (`columns.ts`).
    const touched = new Set(assignments.map(({ field }) => field.key));

    return {
      record,
      before: query.before ? toFieldValues(result, query.before, touched) : null,
      after: toFieldValues(result, query.select, touched),
    };
  }

  /**
   * Runs the write against the customer's database. What comes back from a
   * failure is a category and, where the database named the column, a path the
   * renderer can put the sentence under — never the driver's words, which name
   * hosts, constraints and the values that were sent.
   */
  private async execute(
    context: WriteContext,
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

/**
 * What a write that did not happen is recorded as. It carries no values on
 * either side: nothing was replaced, and what was submitted and refused is what
 * the caller was already told, one problem at a time.
 */
function refusalOf(plan: WritePlan, error: unknown): AuditEvent {
  const { outcome, reason } = outcomeOf(error);

  return {
    kind: plan.mode,
    resourceKey: plan.resource.key,
    // A create that failed never got a key; an update names the one it was
    // pointed at, whether or not a record turned out to be there.
    recordId: plan.mode === "update" ? plan.id : null,
    actionKey: null,
    outcome,
    reason,
    before: null,
    after: null,
  };
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
