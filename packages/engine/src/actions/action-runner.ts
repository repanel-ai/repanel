import {
  formatList,
  type Action,
  type ActionResultDto,
  type DbUpdateAction,
  type HttpCallAction,
  type RecordId,
  type Resource,
} from "@repanel/contracts";
import type { QueryResult } from "pg";
import { NotFoundError, QueryTimeoutError } from "../errors.js";
import { indexFields, requireField } from "../query/fields.js";
import { QueryBuilder, type Query } from "../query/query-builder.js";
import { RecordReader, type ReadContext } from "../read/record-reader.js";
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

/** What reading takes, plus the one secret writing needs. */
export interface ActionContext extends ReadContext {
  /**
   * The signing secret for these actions, read when an `httpCall` is about to
   * be signed and never for a `dbUpdate`. A function rather than a string, so
   * that running an action that signs nothing reads no secret.
   */
  secret: () => Promise<string>;
}

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
   */
  async run(
    context: ActionContext,
    resourceKey: string,
    id: RecordId,
    actionKey: string,
  ): Promise<ActionResultDto> {
    const resource = requireResource(context.resources, resourceKey);
    const action = requireAction(resource, actionKey);

    if (action.kind === "dbUpdate") await this.update(context, resource, action, id);
    else await this.call(context, resource, action, id);

    // The definition's own word for what just happened, so the acknowledgement
    // an operator reads is worded like the button they pressed.
    return { ok: true, label: action.label };
  }

  /**
   * One field of one record, set to the literal the definition names. Nothing
   * about which field or which value comes from the request — both were fixed
   * when the action was written, and validation has already established that
   * the field is an `enum` or `boolean` the literal fits.
   */
  private async update(
    context: ActionContext,
    resource: Resource,
    action: DbUpdateAction,
    id: RecordId,
  ): Promise<void> {
    const field = requireField(indexFields(resource), action.field, resource);
    const result = await this.execute(context, this.queries.update(resource, field, action.value, id));

    // Nothing was updated, so there was nothing there to update. An admin that
    // reports success for a record it did not touch is worse than one that
    // fails, because the operator stops looking.
    if (result.rowCount === 0) throw new NotFoundError("Record not found");
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
   */
  private async call(
    context: ActionContext,
    resource: Resource,
    action: HttpCallAction,
    id: RecordId,
  ): Promise<void> {
    const record = await this.reader.getRecord(context, resource.key, id);
    const url = resolveActionUrl(resource, action, record.values);
    const secret = await context.secret();

    await this.http.send({ method: action.method, url, secret });
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
