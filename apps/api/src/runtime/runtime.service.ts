import { Injectable } from "@nestjs/common";
import {
  formatList,
  validateDefinition,
  type Definition,
  type ListRecordsQuery,
  type RecordDto,
  type RecordId,
  type RecordListDto,
  type Relationship,
  type Resource,
} from "@repanel/contracts";
import type { QueryResult } from "pg";
import { CustomerPoolService } from "../connections/customer-pool.service";
import { DefinitionsService } from "../definitions/definitions.service";
import {
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  type DomainError,
} from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { identityField, indexFields, requireField } from "./query/fields";
import {
  LOOKUP_ALIAS,
  QueryBuilderService,
  TOTAL_ALIAS,
  type Ownership,
  type Query,
} from "./query/query-builder.service";
import { toRecordDtos, toTotal } from "./records.mapper";

/** The customer's database ran out of the time the pool gave the statement. */
const STATEMENT_TIMEOUT = "57014";

/** A value the column's type cannot read — an id or a filter that is not one. */
const INVALID_TEXT_REPRESENTATION = "22P02";

const NO_DEFINITION = "This project has no valid definition yet";

/** A project, its definition, and the resource a route named in it. */
interface ResourceContext {
  projectId: string;
  definition: Definition;
  resources: ReadonlyMap<string, Resource>;
  resource: Resource;
}

/**
 * Reads a customer's database on behalf of the admin the definition describes.
 * It decides who may ask and what the definition allows to be asked; the SQL
 * itself is the query builder's, and the connection is the pool's. Nothing here
 * writes.
 */
@Injectable()
export class RuntimeService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly definitions: DefinitionsService,
    private readonly pools: CustomerPoolService,
    private readonly queries: QueryBuilderService,
  ) {}

  /** The definition the renderer draws, or nothing to draw it from. */
  async definitionFor(ownerId: string, projectKey: string): Promise<Definition> {
    return (await this.context(ownerId, projectKey)).definition;
  }

  async listRecords(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const context = await this.resourceContext(ownerId, projectKey, resourceKey);

    return this.page(context, this.queries.records(context.resources, context.resource, query), query);
  }

  async getRecord(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
  ): Promise<RecordDto> {
    const { projectId, resources, resource } = await this.resourceContext(ownerId, projectKey, resourceKey);

    const query = this.queries.record(resources, resource, id);
    const result = await this.execute(projectId, query, () => new NotFoundError("Record not found"));

    const [record] = toRecordDtos(result, query.select, resource.primaryKey);
    if (!record) throw new NotFoundError("Record not found");
    return record;
  }

  /**
   * A page of the records one record is related to. Whichever way the
   * relationship points, the page is the target resource's list — its columns,
   * its search, its filters, its sort — narrowed to one column. The resource in
   * the URL contributes the relationship and the id, and nothing else.
   */
  async listRelated(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const parent = await this.resourceContext(ownerId, projectKey, resourceKey);
    const relationship = this.requireRelationship(parent.resource, relationshipKey);
    const target = this.requireResource(parent.resources, relationship.target);
    const context: ResourceContext = { ...parent, resource: target };

    const owner = await this.ownership(parent, target, relationship, id);
    if (!owner) return emptyPage(query);

    return this.page(context, this.queries.records(parent.resources, target, query, owner), query);
  }

  /**
   * Which column of the target narrows the page, and to what. Both kinds read
   * the record in the URL first: it answers whether that record is there at
   * all, and for a `belongsTo` it also answers which record it points at.
   */
  private async ownership(
    parent: ResourceContext,
    target: Resource,
    relationship: Relationship,
    id: RecordId,
  ): Promise<Ownership | undefined> {
    const parentFields = indexFields(parent.resource);
    const read =
      relationship.kind === "belongsTo"
        ? requireField(parentFields, relationship.foreignKey, parent.resource)
        : identityField(parent.resource);

    const lookup = this.queries.lookup(parent.resource, id, read);
    const result = await this.execute(parent.projectId, lookup, () => new NotFoundError("Record not found"));
    const [row] = result.rows as Array<Record<string, unknown>>;
    if (!row) throw new NotFoundError("Record not found");

    if (relationship.kind === "hasMany") {
      // The foreign key of a `hasMany` lives on the target, and validation has
      // already established that it is a field there.
      const field = requireField(indexFields(target), relationship.foreignKey, target);
      return { field, id };
    }

    const foreignKey = row[LOOKUP_ALIAS];
    // The record points at nothing, which is a page with nothing on it rather
    // than a record that is missing.
    if (foreignKey === null || foreignKey === undefined) return undefined;

    return { field: identityField(target), id: foreignKey as RecordId };
  }

  private async page(
    context: ResourceContext,
    queries: { rows: Query; total: Query },
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const unusable = (): DomainError =>
      new InvalidQueryError("A filter value is not one the field it filters can hold.");

    const [rows, total] = await Promise.all([
      this.execute(context.projectId, queries.rows, unusable),
      this.execute(context.projectId, queries.total, unusable),
    ]);

    return {
      records: toRecordDtos(rows, queries.rows.select, context.resource.primaryKey),
      total: toTotal((total.rows[0] as Record<string, unknown> | undefined)?.[TOTAL_ALIAS]),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Runs one statement against the project's database. What comes back from a
   * failure is a category, never the driver's words: those name hosts, columns
   * and the values that were sent, and the caller has already been told
   * everything it is owed.
   */
  private async execute(
    projectId: string,
    query: Query,
    unusableValue: () => DomainError,
  ): Promise<QueryResult> {
    const pool = await this.pools.poolFor(projectId);
    try {
      return await pool.query({ text: query.text, values: query.values });
    } catch (error) {
      const code = (error as { code?: unknown } | null | undefined)?.code;
      if (code === STATEMENT_TIMEOUT) {
        throw new QueryTimeoutError("The database took too long to answer this query.");
      }
      if (code === INVALID_TEXT_REPRESENTATION) throw unusableValue();
      throw error;
    }
  }

  private async context(
    ownerId: string,
    projectKey: string,
  ): Promise<{ projectId: string; definition: Definition; resources: ReadonlyMap<string, Resource> }> {
    const project = await this.projects.requireOwnedByKey(projectKey, ownerId);
    const draft = await this.definitions.getDraft({ kind: "user", userId: ownerId }, project.id);
    if (!draft) throw new NotFoundError(NO_DEFINITION);

    // Validated again rather than trusted: the stored payload is what was
    // submitted, and what the runtime needs is what validation makes of it —
    // defaults applied, and a type the query builder can walk.
    const result = validateDefinition(draft.payload);
    if (!result.valid) throw new NotFoundError(NO_DEFINITION);

    return {
      projectId: project.id,
      definition: result.definition,
      resources: new Map(result.definition.resources.map((resource) => [resource.key, resource])),
    };
  }

  private async resourceContext(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
  ): Promise<ResourceContext> {
    const context = await this.context(ownerId, projectKey);
    return { ...context, resource: this.requireResource(context.resources, resourceKey) };
  }

  private requireResource(resources: ReadonlyMap<string, Resource>, key: string): Resource {
    const resource = resources.get(key);
    if (!resource) {
      throw new NotFoundError(
        `This admin has no resource \`${key}\`. Resources: ${formatList([...resources.keys()])}.`,
      );
    }
    return resource;
  }

  private requireRelationship(resource: Resource, key: string): Relationship {
    const relationship = resource.relationships.find((candidate) => candidate.key === key);
    if (!relationship) {
      throw new NotFoundError(
        `Resource \`${resource.key}\` has no relationship \`${key}\`. Relationships: ${formatList(
          resource.relationships.map((candidate) => candidate.key),
        )}.`,
      );
    }
    return relationship;
  }
}

function emptyPage(query: ListRecordsQuery): RecordListDto {
  return { records: [], total: 0, page: query.page, pageSize: query.pageSize };
}
