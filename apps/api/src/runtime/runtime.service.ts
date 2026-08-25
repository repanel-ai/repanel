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
import { RecordReader, indexResources, type ReadContext } from "@repanel/engine";
import type { Principal } from "../auth/principal";
import { CustomerPoolService } from "../connections/customer-pool.service";
import { DefinitionsService } from "../definitions/definitions.service";
import { NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";

/** Nothing has ever been submitted: the authoring loop has not run. */
const NO_DEFINITION = "This project has no definition yet";

/** A draft exists and nobody has made it live. Said apart from the above
 *  because they are two different things to go and do about it. */
const NOT_PUBLISHED = "This admin has not been published yet";

/** A version is live but no longer validates — a narrowing landed under it. */
const UNSERVABLE = "This project has no valid definition yet";

/** A project, the definition it is rendered from, and the database behind it. */
export interface ProjectContext extends ReadContext {
  projectId: string;
  definition: Definition;
}

/**
 * The rendered admin's read side. It decides who may ask and which definition
 * the answer comes out of; what the definition allows to be asked, and the SQL
 * that asks it, belong to the engine. Nothing here writes.
 */
@Injectable()
export class RuntimeService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly definitions: DefinitionsService,
    private readonly pools: CustomerPoolService,
    private readonly reader: RecordReader,
  ) {}

  /** The definition the renderer draws, or nothing to draw it from. */
  async definitionFor(ownerId: string, projectKey: string): Promise<Definition> {
    return (await this.readContext(ownerId, projectKey)).definition;
  }

  async listRecords(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const context = await this.readContext(ownerId, projectKey);

    return this.reader.listRecords(context, resourceKey, query);
  }

  async getRecord(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
  ): Promise<RecordDto> {
    const context = await this.readContext(ownerId, projectKey);

    return this.reader.getRecord(context, resourceKey, id);
  }

  /**
   * The records a relation may be pointed at. It is a read like any other here
   * — the same owner check, the same published definition — and what a picker
   * is allowed to see is the engine's answer, not this one's.
   */
  async listOptions(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    query: OptionsQuery,
  ): Promise<RecordOptionDto[]> {
    const context = await this.readContext(ownerId, projectKey);

    return this.reader.listOptions(context, resourceKey, query);
  }

  async listRelated(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const context = await this.readContext(ownerId, projectKey);

    return this.reader.listRelated(context, resourceKey, id, relationshipKey, query);
  }

  /**
   * A project's definition and its database, with ownership already
   * established. Public because acting on a record starts exactly where reading
   * one does — the same owner check, the same revalidated definition — and the
   * actions feature reaching for this instead of assembling its own is what
   * keeps there being one answer to "may this caller see this admin".
   */
  async readContext(ownerId: string, projectKey: string): Promise<ProjectContext> {
    const principal: Principal = { kind: "user", userId: ownerId };
    const project = await this.projects.requireOwnedByKey(projectKey, ownerId);

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
      resources: indexResources(result.definition),
      // Asked for when a statement is ready to send, so that a resource this
      // admin does not have is answered as one whether or not there is a
      // database behind it.
      pool: () => this.pools.poolFor(project.id),
    };
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
