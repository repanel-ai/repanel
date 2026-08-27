import type {
  ActionResultDto,
  ConnectionKind,
  Definition,
  ListRecordsQuery,
  OptionsQuery,
  RecordDto,
  RecordId,
  RecordListDto,
  RecordOptionDto,
  RecordWrite,
} from "@repanel/contracts";
import type { AuditWriter, ReadContext } from "@repanel/engine";

/** A project, the definition it is rendered from, and the database behind it. */
export interface ProjectContext extends ReadContext {
  projectId: string;
  definition: Definition;
  /** The published version this context was resolved out of. It travels with a
   *  connector request, so both ends serve the same definition or say so. */
  definitionVersion: number;
  /**
   * How this project's database is reached, asked for when a statement is ready
   * to send and not before — for exactly the reason the pool is: a resource
   * this admin does not have is answered as one whether or not there is
   * anything behind it.
   */
  connectionKind: () => Promise<ConnectionKind>;
}

/** Everything serving one request against a project's admin takes. */
export interface ServingContext extends ProjectContext {
  /** Where a write is accounted for. Never reached by a read. */
  audit: AuditWriter;
  /** The project's action signing secret, read only when there is something to
   *  sign. Never reached by a read. */
  secret: () => Promise<string>;
}

/**
 * A request that files nothing, and one that signs nothing.
 *
 * Reads never do either, and a form write never signs. They are refusals rather
 * than quiet no-ops on purpose: a read that reached for an audit writer, or a
 * form that reached for a signing secret, would be a bug worth hearing about
 * rather than one that lands silently.
 */
export const FILES_NOTHING: AuditWriter = () =>
  Promise.reject(new Error("this request does not file audit events"));

export const SIGNS_NOTHING = (): Promise<string> =>
  Promise.reject(new Error("this request does not sign anything"));

/**
 * The seven things RePanel can do to a customer's database, and the seam the
 * two trust ladder rungs meet at.
 *
 * It is the engine's own surface, method for method — `LocalExecutor` is the
 * engine with a pool behind it, `ConnectorExecutor` is a descriptor on a wire
 * with the same engine at the far end. Nothing else in this API knows which one
 * it is talking to, and there is no eighth method: a capability that is not
 * here does not exist on either rung, which is the whole of "no connector-only
 * query path" (DECISIONS #064).
 */
export interface RuntimeExecutor {
  listRecords(resourceKey: string, query: ListRecordsQuery): Promise<RecordListDto>;
  getRecord(resourceKey: string, id: RecordId): Promise<RecordDto>;
  listOptions(resourceKey: string, query: OptionsQuery): Promise<RecordOptionDto[]>;
  listRelated(
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto>;
  createRecord(resourceKey: string, write: RecordWrite): Promise<RecordDto>;
  updateRecord(resourceKey: string, id: RecordId, write: RecordWrite): Promise<RecordDto>;
  runAction(resourceKey: string, id: RecordId, actionKey: string): Promise<ActionResultDto>;
}
