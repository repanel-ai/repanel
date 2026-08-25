import {
  formatList,
  type ListRecordsQuery,
  type RecordDto,
  type RecordId,
  type RecordListDto,
  type Relationship,
  type Resource,
} from "@repanel/contracts";
import type { Pool, QueryResult } from "pg";
import { InvalidQueryError, NotFoundError, QueryTimeoutError, type DomainError } from "../errors.js";
import { identityField, indexFields, requireField } from "../query/fields.js";
import {
  LOOKUP_ALIAS,
  QueryBuilder,
  TOTAL_ALIAS,
  type Ownership,
  type Query,
} from "../query/query-builder.js";
import { requireResource } from "../resources.js";
import { toRecordDtos, toTotal } from "./records.mapper.js";

/** The customer's database ran out of the time the pool gave the statement. */
const STATEMENT_TIMEOUT = "57014";

/**
 * Class 22, a value the column it is compared against cannot hold: not that
 * type's syntax (22P02), not a number it can fit (22003), not a date (22007).
 * The class rather than a list of codes, because this engine writes no
 * arithmetic and no assignments — every class-22 failure it can raise came in
 * as an id or a filter from the caller.
 */
const DATA_EXCEPTION = "22";

/** A definition, and the database it describes. */
export interface ReadContext {
  /** Every resource the definition declares, by key. */
  resources: ReadonlyMap<string, Resource>;
  /**
   * The database to run against, asked for when a statement is ready to send.
   * A function rather than a pool, so that a resource this admin does not have
   * is answered as one whether or not there is a database behind it.
   */
  pool: () => Promise<Pool>;
}

/**
 * Reads a customer's database on behalf of the admin a definition describes.
 * It decides what the definition allows to be asked; the SQL itself is the
 * query builder's, and the connection is the caller's. Nothing here writes, and
 * nothing here decides who may ask — a caller has been authorized long before
 * it gets this far.
 */
export class RecordReader {
  constructor(private readonly queries: QueryBuilder) {}

  async listRecords(
    context: ReadContext,
    resourceKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const resource = requireResource(context.resources, resourceKey);

    return this.page(context, resource, this.queries.records(context.resources, resource, query), query);
  }

  async getRecord(context: ReadContext, resourceKey: string, id: RecordId): Promise<RecordDto> {
    const resource = requireResource(context.resources, resourceKey);

    const query = this.queries.record(context.resources, resource, id);
    const result = await this.execute(context, query, () => new NotFoundError("Record not found"));

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
    context: ReadContext,
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const parent = requireResource(context.resources, resourceKey);
    const relationship = requireRelationship(parent, relationshipKey);
    const target = requireResource(context.resources, relationship.target);

    const owner = await this.ownership(context, parent, target, relationship, id);
    if (!owner) return emptyPage(query);

    return this.page(
      context,
      target,
      this.queries.records(context.resources, target, query, owner),
      query,
    );
  }

  /**
   * Which column of the target narrows the page, and to what. Both kinds read
   * the record in the URL first: it answers whether that record is there at
   * all, and for a `belongsTo` it also answers which record it points at.
   */
  private async ownership(
    context: ReadContext,
    parent: Resource,
    target: Resource,
    relationship: Relationship,
    id: RecordId,
  ): Promise<Ownership | undefined> {
    const parentFields = indexFields(parent);
    const read =
      relationship.kind === "belongsTo"
        ? requireField(parentFields, relationship.foreignKey, parent)
        : identityField(parent);

    const lookup = this.queries.lookup(parent, id, read);
    const result = await this.execute(context, lookup, () => new NotFoundError("Record not found"));
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
    context: ReadContext,
    resource: Resource,
    queries: { rows: Query; total: Query },
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    const unusable = (): DomainError =>
      new InvalidQueryError("A filter value is not one the field it filters can hold.");

    const [rows, total] = await Promise.all([
      this.execute(context, queries.rows, unusable),
      this.execute(context, queries.total, unusable),
    ]);

    return {
      records: toRecordDtos(rows, queries.rows.select, resource.primaryKey),
      total: toTotal((total.rows[0] as Record<string, unknown> | undefined)?.[TOTAL_ALIAS]),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Runs one statement against the customer's database. What comes back from a
   * failure is a category, never the driver's words: those name hosts, columns
   * and the values that were sent, and the caller has already been told
   * everything it is owed.
   */
  private async execute(
    context: ReadContext,
    query: Query,
    unusableValue: () => DomainError,
  ): Promise<QueryResult> {
    const pool = await context.pool();
    try {
      return await pool.query({ text: query.text, values: query.values });
    } catch (error) {
      const code = (error as { code?: unknown } | null | undefined)?.code;
      if (code === STATEMENT_TIMEOUT) {
        throw new QueryTimeoutError("The database took too long to answer this query.");
      }
      if (typeof code === "string" && code.startsWith(DATA_EXCEPTION)) throw unusableValue();
      throw error;
    }
  }
}

function requireRelationship(resource: Resource, key: string): Relationship {
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

function emptyPage(query: ListRecordsQuery): RecordListDto {
  return { records: [], total: 0, page: query.page, pageSize: query.pageSize };
}
