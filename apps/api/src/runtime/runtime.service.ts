import { Injectable } from "@nestjs/common";
import {
  validateDefinition,
  type Definition,
  type ListRecordsQuery,
  type OptionsQuery,
  type RecordDto,
  type RecordId,
  type RecordListDto,
  type RecordOptionDto,
} from "@repanel/contracts";
import { indexResources } from "@repanel/engine";
import type { Principal } from "../auth/principal";
import { ConnectionsService } from "../connections/connections.service";
import { CustomerPoolService } from "../connections/customer-pool.service";
import { DefinitionsService } from "../definitions/definitions.service";
import { NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { ExecutorsService } from "./executors.service";
import { FILES_NOTHING, SIGNS_NOTHING } from "./runtime-executor";
import type { ProjectContext, ServingContext } from "./runtime-executor";

/** Nothing has ever been submitted: the authoring loop has not run. */
const NO_DEFINITION = "This project has no definition yet";

/** A draft exists and nobody has made it live. Said apart from the above
 *  because they are two different things to go and do about it. */
const NOT_PUBLISHED = "This admin has not been published yet";

/** A version is live but no longer validates — a narrowing landed under it. */
const UNSERVABLE = "This project has no valid definition yet";

/** A read files nothing and signs nothing. */
const READS_ONLY = { audit: FILES_NOTHING, secret: SIGNS_NOTHING };

/**
 * The rendered admin's read side. It decides who may ask and which definition
 * the answer comes out of; what the definition allows to be asked, and the SQL
 * that asks it, belong to the engine — running here or beside the customer's
 * database, which is `ExecutorsService`'s decision and nothing else's. Nothing
 * here writes.
 */
@Injectable()
export class RuntimeService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly definitions: DefinitionsService,
    private readonly connections: ConnectionsService,
    private readonly pools: CustomerPoolService,
    private readonly executors: ExecutorsService,
  ) {}

  /** The definition the renderer draws, or nothing to draw it from. */
  async definitionFor(userId: string, projectKey: string): Promise<Definition> {
    return (await this.readContext(userId, projectKey)).definition;
  }

  async listRecords(
    userId: string,
    projectKey: string,
    resourceKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    return (await this.reading(userId, projectKey)).listRecords(resourceKey, query);
  }

  async getRecord(
    userId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
  ): Promise<RecordDto> {
    return (await this.reading(userId, projectKey)).getRecord(resourceKey, id);
  }

  /**
   * The records a relation may be pointed at. It is a read like any other here
   * — the same membership check, the same published definition — and what a picker
   * is allowed to see is the engine's answer, not this one's.
   */
  async listOptions(
    userId: string,
    projectKey: string,
    resourceKey: string,
    query: OptionsQuery,
  ): Promise<RecordOptionDto[]> {
    return (await this.reading(userId, projectKey)).listOptions(resourceKey, query);
  }

  async listRelated(
    userId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    return (await this.reading(userId, projectKey)).listRelated(
      resourceKey,
      id,
      relationshipKey,
      query,
    );
  }

  /**
   * A project's definition and its database, with ownership already
   * established. Public because acting on a record starts exactly where reading
   * one does — the same membership check, the same revalidated definition — and
   * the actions feature reaching for this instead of assembling its own is what
   * keeps there being one answer to "may this caller see this admin".
   *
   * `operator` is the floor, and this is the door operators come through: the
   * whole of an operator's account is the admin behind this method.
   */
  async readContext(userId: string, projectKey: string): Promise<ProjectContext> {
    const principal: Principal = { kind: "user", userId };
    const project = await this.projects.requireMemberByKey(projectKey, userId, "operator");

    // The published version, never the draft. What an agent submits next is not
    // a deployment, so an admin being served cannot be taken down by one.
    const published = await this.definitions.getPublished(principal, project.id);
    if (!published) throw new NotFoundError(await this.nothingPublished(principal, project.id));

    // Validated again rather than trusted: the stored payload is what was
    // submitted, and what the engine needs is what validation makes of it —
    // defaults applied, and a type the query builder can walk.
    const result = validateDefinition(published.payload);
    if (!result.valid) throw new NotFoundError(UNSERVABLE);

    return {
      projectId: project.id,
      definition: result.definition,
      definitionVersion: published.version,
      resources: indexResources(result.definition),
      // Both of these are asked for when a statement is ready to send, and for
      // the same reason: a resource this admin does not have is answered as one
      // whether or not there is a database behind it, and whether or not the
      // connector that would have served it is running.
      connectionKind: () => this.connections.kindFor(project.id),
      pool: () => this.pools.poolFor(project.id),
    };
  }

  /** The same door, for the reads this service serves itself. */
  private async reading(userId: string, projectKey: string) {
    const context = await this.readContext(userId, projectKey);
    return this.executors.for({ ...context, ...READS_ONLY } satisfies ServingContext);
  }

  /**
   * Why there is nothing to serve. Only asked once there is nothing — a project
   * waiting on its first definition and one whose draft is waiting to be
   * published are the same blank screen otherwise, and they are not the same
   * thing to go and do.
   */
  private async nothingPublished(principal: Principal, projectId: string): Promise<string> {
    const draft = await this.definitions.getValidationResult(principal, projectId);
    return draft ? NOT_PUBLISHED : NO_DEFINITION;
  }
}
