import { Injectable } from "@nestjs/common";
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
import { CustomerPoolService } from "../connections/customer-pool.service";
import { NotFoundError, QueryTimeoutError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import type { Query } from "../runtime/query/query-builder.service";
import { QueryBuilderService } from "../runtime/query/query-builder.service";
import { indexFields, requireField } from "../runtime/query/fields";
import { RuntimeService } from "../runtime/runtime.service";
import { resolveActionUrl } from "./action-url";
import { HttpCallService } from "./http-call.service";

/** The customer's database ran out of the time the pool gave the statement. */
const STATEMENT_TIMEOUT = "57014";

/**
 * Class 22, a value the column it is compared against cannot hold. The only
 * value this feature binds into a predicate is the record id out of the URL, so
 * a class-22 failure here means the id could never have named a row — which is
 * the same answer as no row matching, and is told the same way.
 */
const DATA_EXCEPTION = "22";

/**
 * The one thing an operator can do to a record, and the only writes RePanel
 * performs at all.
 *
 * It is a feature of its own rather than another method on the runtime, because
 * the runtime's guarantee is that it never writes and because a signing secret,
 * an HMAC and an outbound HTTP client have nothing to do with reading records.
 * What it does share it shares deliberately: the resolved definition and the
 * SQL come from the runtime module's own services, so there is still one answer
 * to "may this caller see this resource" and one place a statement is built
 * (DECISIONS #024).
 */
@Injectable()
export class ActionsService {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly projects: ProjectsService,
    private readonly queries: QueryBuilderService,
    private readonly pools: CustomerPoolService,
    private readonly http: HttpCallService,
  ) {}

  /**
   * Runs one of a resource's declared actions against one record. The action is
   * looked up in the definition by key: the request names which action, never
   * what it does, so a caller cannot ask for an update or a call the definition
   * does not already contain.
   */
  async run(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    actionKey: string,
  ): Promise<ActionResultDto> {
    const { projectId, resource } = await this.runtime.resourceContext(
      ownerId,
      projectKey,
      resourceKey,
    );
    const action = requireAction(resource, actionKey);

    if (action.kind === "dbUpdate") await this.update(projectId, resource, action, id);
    else await this.call(ownerId, projectKey, projectId, resource, action, id);

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
    projectId: string,
    resource: Resource,
    action: DbUpdateAction,
    id: RecordId,
  ): Promise<void> {
    const field = requireField(indexFields(resource), action.field, resource);
    const result = await this.execute(projectId, this.queries.update(resource, field, action.value, id));

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
    ownerId: string,
    projectKey: string,
    projectId: string,
    resource: Resource,
    action: HttpCallAction,
    id: RecordId,
  ): Promise<void> {
    const record = await this.runtime.getRecord(ownerId, projectKey, resource.key, id);
    const url = resolveActionUrl(resource, action, record.values);
    const secret = await this.projects.actionSecret(projectId);

    await this.http.send({ method: action.method, url, secret });
  }

  /**
   * Runs one statement against the project's database. What comes back from a
   * failure is a category, never the driver's words: those name hosts, columns
   * and the values that were sent.
   */
  private async execute(projectId: string, query: Query): Promise<QueryResult> {
    const pool = await this.pools.poolFor(projectId);
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
