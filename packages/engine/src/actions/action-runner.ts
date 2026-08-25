import {
  formatList,
  type Action,
  type ActionKind,
  type ActionResultDto,
  type AuditValues,
  type DbUpdateAction,
  type HttpCallAction,
  type RecordId,
  type Resource,
} from "@repanel/contracts";
import type { QueryResult } from "pg";
import type { AuditEvent, WriteContext } from "../audit/audit-event.js";
import { outcomeOf } from "../audit/outcome.js";
import { NotFoundError, QueryTimeoutError } from "../errors.js";
import { indexFields, requireField } from "../query/fields.js";
import { QueryBuilder, type Query } from "../query/query-builder.js";
import { RecordReader } from "../read/record-reader.js";
import { toFieldValues } from "../read/records.mapper.js";
import { requireResource } from "../resources.js";
import { resolveActionUrl } from "./action-url.js";
import { HttpCall } from "./http-call.js";

/** The customer's database ran out of the time the pool gave the statement. */
const STATEMENT_TIMEOUT = "57014";

/**
 * Class 22, a value the column it is compared against cannot hold. The only
 * value this runner binds into a predicate is the record id it was given, so a
 * class-22 failure here means the id could never have named a row — which is
 * the same answer as no row matching, and is told the same way.
 */
const DATA_EXCEPTION = "22";

/** What reading takes, plus somewhere to account for the write and the one
 *  secret writing needs. */
export interface ActionContext extends WriteContext {
  /**
   * The signing secret for these actions, read when an `httpCall` is about to
   * be signed and never for a `dbUpdate`. A function rather than a string, so
   * that running an action that signs nothing reads no secret.
   */
  secret: () => Promise<string>;
}

/** What a write moved, on both sides of it. An `httpCall` moves nothing here. */
interface Change {
  before: AuditValues | null;
  after: AuditValues | null;
}

/** An action that changed no column of ours, which is every `httpCall`. */
const NOTHING: Change = { before: null, after: null };

/**
 * The one thing an operator can do to a record, and the only writes RePanel
 * performs at all.
 *
 * It sits beside the reader rather than inside it, because the reader's
 * guarantee is that it never writes and because a signing secret, an HMAC and
 * an outbound HTTP client have nothing to do with reading records. What it does
 * share it shares deliberately: the SQL comes from the same builder, so there
 * is still one place a statement is assembled (DECISIONS #024).
 */
export class ActionRunner {
  constructor(
    private readonly reader: RecordReader,
    private readonly queries: QueryBuilder,
    private readonly http: HttpCall,
  ) {}

  /**
   * Runs one of a resource's declared actions against one record. The action is
   * looked up in the definition by key: the request names which action, never
   * what it does, so a caller cannot ask for an update or a call the definition
   * does not already contain.
   *
   * From the moment an action is named, its outcome is recorded — the one that
   * succeeded, the one the application refused, and the one that never got as
   * far as leaving. An admin whose log holds only the successes answers "did
   * anyone try" with silence.
   */
  async run(
    context: ActionContext,
    resourceKey: string,
    id: RecordId,
    actionKey: string,
  ): Promise<ActionResultDto> {
    const resource = requireResource(context.resources, resourceKey);
    const action = requireAction(resource, actionKey);

    let change: Change;
    try {
      change =
        action.kind === "dbUpdate"
          ? await this.update(context, resource, action, id)
          : await this.call(context, resource, action, id);
    } catch (error) {
      const { outcome, reason } = outcomeOf(error);
      // Best-effort on this side whichever kind it was: the caller is owed the
      // answer about their action, and a log that could not be written must not
      // become a different failure than the one that happened.
      await context
        .audit(eventFor(resource, action, id, outcome, reason, NOTHING))
        .catch(() => undefined);
      throw error;
    }

    await this.file(context, eventFor(resource, action, id, "ok", null, change), action.kind);

    // The definition's own word for what just happened, so the acknowledgement
    // an operator reads is worded like the button they pressed.
    return { ok: true, label: action.label };
  }

  /**
   * Files what an action came to.
   *
   * The two kinds are held to different standards, and the difference is the
   * whole of it. A `dbUpdate` is RePanel's own write, so the operator is not
   * told it succeeded until it has been accounted for. An `httpCall`'s effect
   * already landed inside the customer's application and cannot be taken back,
   * so answering "it failed" because a row could not be filed would report
   * something that did not happen — the worse of the two lies (DECISIONS #061).
   */
  private async file(context: ActionContext, event: AuditEvent, kind: ActionKind): Promise<void> {
    const filed = context.audit(event);

    if (kind === "httpCall") {
      await filed.catch(() => undefined);
      return;
    }
    await filed;
  }

  /**
   * One field of one record, set to the literal the definition names. Nothing
   * about which field or which value comes from the request — both were fixed
   * when the action was written, and validation has already established that
   * the field is an `enum` or `boolean` the literal fits.
   *
   * What it answers with is the column on both sides of the write, read out of
   * the one statement that performed it.
   */
  private async update(
    context: ActionContext,
    resource: Resource,
    action: DbUpdateAction,
    id: RecordId,
  ): Promise<Change> {
    const field = requireField(indexFields(resource), action.field, resource);
    const query = this.queries.setField(resource, field, action.value, id);
    const result = await this.execute(context, query);

    // Nothing was updated, so there was nothing there to update. An admin that
    // reports success for a record it did not touch is worse than one that
    // fails, because the operator stops looking.
    if (result.rowCount === 0) throw new NotFoundError("Record not found");

    const touched = new Set([field.key]);
    return {
      before: query.before ? toFieldValues(result, query.before, touched) : null,
      after: toFieldValues(result, query.select, touched),
    };
  }

  /**
   * A signed call to the customer's application, at an address built from the
   * record's own current values.
   *
   * The record is read here rather than taken from the client. The browser
   * knows the id, and that is all it is allowed to contribute: the field values
   * that fill the URL are whatever the database says they are at the moment the
   * action runs, which is also the only reading that could be true by the time
   * the request lands.
   *
   * Nothing is recorded on either side of it beyond the attempt and how it
   * ended. What the endpoint did is the application's to log: RePanel does not
   * read the response, and an admin that guessed at what a call changed would
   * be filing a guess.
   */
  private async call(
    context: ActionContext,
    resource: Resource,
    action: HttpCallAction,
    id: RecordId,
  ): Promise<Change> {
    const record = await this.reader.getRecord(context, resource.key, id);
    const url = resolveActionUrl(resource, action, record.values);
    const secret = await context.secret();

    await this.http.send({ method: action.method, url, secret });

    return NOTHING;
  }

  /**
   * Runs one statement against the customer's database. What comes back from a
   * failure is a category, never the driver's words: those name hosts, columns
   * and the values that were sent.
   */
  private async execute(context: ActionContext, query: Query): Promise<QueryResult> {
    const pool = await context.pool();
    try {
      return await pool.query({ text: query.text, values: query.values });
    } catch (error) {
      const code = (error as { code?: unknown } | null | undefined)?.code;
      if (code === STATEMENT_TIMEOUT) {
        throw new QueryTimeoutError("The database took too long to answer this query.");
      }
      if (typeof code === "string" && code.startsWith(DATA_EXCEPTION)) {
        throw new NotFoundError("Record not found");
      }
      throw error;
    }
  }
}

function eventFor(
  resource: Resource,
  action: Action,
  id: RecordId,
  outcome: AuditEvent["outcome"],
  reason: string | null,
  change: Change,
): AuditEvent {
  return {
    kind: "action",
    resourceKey: resource.key,
    recordId: id,
    actionKey: action.key,
    outcome,
    reason,
    before: change.before,
    after: change.after,
  };
}

/**
 * The action a key names. A miss is answered like every other thing this admin
 * does not have — with what it does have, because an action key is written by
 * hand into a URL far more often than a definition is.
 */
function requireAction(resource: Resource, key: string): Action {
  const action = resource.actions.find((candidate) => candidate.key === key);
  if (!action) {
    throw new NotFoundError(
      `Resource \`${resource.key}\` has no action \`${key}\`. Actions: ${formatList(
        resource.actions.map((candidate) => candidate.key),
      )}.`,
    );
  }
  return action;
}
