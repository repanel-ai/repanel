import type {
  ActionResultDto,
  Descriptor,
  FrameAuditEvent,
  ListRecordsQuery,
  OptionsQuery,
  RecordDto,
  RecordId,
  RecordListDto,
  RecordOptionDto,
  RecordWrite,
} from "@repanel/contracts";
import {
  CALL_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  requireResource,
  type AuditEvent,
} from "@repanel/engine";
import type { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import { toDomainError } from "./frame-errors";
import type { RuntimeExecutor, ServingContext } from "./runtime-executor";

/**
 * What the hop itself is allowed to cost on top of the work inside it: the
 * frame out, the frame back, and whatever the network is doing today.
 */
const HOP_ALLOWANCE_MS = 3_000;

/**
 * How long Cloud waits for a read or a form write.
 *
 * Strictly longer than the bound the statement runs under at the far end, and
 * derived from it rather than written beside it, so the two cannot drift. The
 * ordering is the whole point: a slow query has to run out of *its* time first,
 * so that it is answered as a slow query by the side that knows it was one. If
 * this fired first, every slow query would read as a network failure
 * (DECISIONS #064).
 */
export const READ_TIMEOUT_MS = STATEMENT_TIMEOUT_MS + HOP_ALLOWANCE_MS;

/**
 * How long Cloud waits for an action. An action reads the record and then
 * either writes or calls out to the customer's application, so its worst case
 * is a statement plus a call — both of which are bounded at the far end, and
 * both of which have to expire before this does.
 */
export const ACTION_TIMEOUT_MS = STATEMENT_TIMEOUT_MS + CALL_TIMEOUT_MS + HOP_ALLOWANCE_MS;

/**
 * The connector rung: the same seven requests, addressed as descriptors and
 * served by the same engine running beside the customer's database.
 *
 * Nothing here builds a statement, and nothing here could: what it sends is a
 * member of the frame contract's closed union, which has no room for one.
 *
 * What it does add is the half of an audit record the far end cannot have. The
 * connector runs the engine, so the event it files is produced by exactly the
 * code that produces one locally — the same before and after values, from the
 * same statement — and it travels back with the answer. Filing it here, before
 * the operator is told anything, is what keeps task 061's promise across the
 * hop: nobody is told a write succeeded before it has been accounted for.
 */
export class ConnectorExecutor implements RuntimeExecutor {
  constructor(
    private readonly sockets: ConnectorSocketsService,
    private readonly context: ServingContext,
  ) {}

  async listRecords(resourceKey: string, query: ListRecordsQuery): Promise<RecordListDto> {
    return this.read({ kind: "listRecords", resourceKey, query });
  }

  async getRecord(resourceKey: string, id: RecordId): Promise<RecordDto> {
    return this.read({ kind: "getRecord", resourceKey, id });
  }

  async listOptions(resourceKey: string, query: OptionsQuery): Promise<RecordOptionDto[]> {
    return this.read({ kind: "listOptions", resourceKey, query });
  }

  async listRelated(
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    return this.read({ kind: "listRelated", resourceKey, id, relationshipKey, query });
  }

  async createRecord(resourceKey: string, write: RecordWrite): Promise<RecordDto> {
    return this.send({ kind: "createRecord", resourceKey, write }, READ_TIMEOUT_MS, true);
  }

  async updateRecord(resourceKey: string, id: RecordId, write: RecordWrite): Promise<RecordDto> {
    return this.send({ kind: "updateRecord", resourceKey, id, write }, READ_TIMEOUT_MS, true);
  }

  async runAction(resourceKey: string, id: RecordId, actionKey: string): Promise<ActionResultDto> {
    return this.send(
      { kind: "runAction", resourceKey, id, actionKey },
      ACTION_TIMEOUT_MS,
      // An `httpCall`'s effect already landed inside the customer's application
      // and cannot be taken back, so answering "it failed" because a row could
      // not be filed would report something that did not happen. A `dbUpdate`
      // is RePanel's own write and is held to the stricter standard. The same
      // ruling the engine makes locally (DECISIONS #061), made here because
      // this is where the filing now happens.
      this.kindOf(resourceKey, actionKey) !== "httpCall",
    );
  }

  /** A read files nothing, so there is never an audit trail to wait on. */
  private read<T>(descriptor: Descriptor): Promise<T> {
    return this.send(descriptor, READ_TIMEOUT_MS, true);
  }

  private async send<T>(descriptor: Descriptor, timeoutMs: number, accountable: boolean): Promise<T> {
    // Asked here rather than at the far end, because Cloud holds the same
    // definition and a resource this admin does not have is answered as one
    // whether or not there is anything behind it — including when the connector
    // serving it is not running.
    requireResource(this.context.resources, descriptor.resourceKey);

    const { outcome, audit } = await this.sockets.execute(
      this.context.projectId,
      this.context.definitionVersion,
      descriptor,
      timeoutMs,
    );

    // A refusal's events are filed best-effort whatever the request was: nothing
    // is unaccounted for at the far end, and a log that could not be written
    // must not replace the answer the caller is owed about their own write.
    await this.file(audit, accountable && outcome.ok);

    if (!outcome.ok) throw toDomainError(outcome.error);
    return outcome.result as T;
  }

  /**
   * Files what the engine said it did. `accountable` is whether failing to file
   * one may fail the request — see the ruling in `runAction` above.
   */
  private async file(events: readonly FrameAuditEvent[], accountable: boolean): Promise<void> {
    for (const event of events) {
      const filed = this.context.audit(event as AuditEvent);
      if (accountable) await filed;
      else await filed.catch(() => undefined);
    }
  }

  /** What kind of action this is, read out of the definition Cloud already holds. */
  private kindOf(resourceKey: string, actionKey: string): string | undefined {
    const resource = requireResource(this.context.resources, resourceKey);
    return resource.actions.find((action) => action.key === actionKey)?.kind;
  }
}
