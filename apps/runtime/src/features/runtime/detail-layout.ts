import type { Definition, DetailSection, Field, Relationship, Resource } from "@repanel/contracts";

type EnumField = Extract<Field, { type: "enum" }>;

/**
 * The state a record wears in its header.
 *
 * v0 picks it with a heuristic — the first enum field of the first section —
 * because nothing in the schema says which field is the record's status. It is
 * a heuristic and not a guess about meaning: it reads the order the author
 * wrote, and an author who puts `status` first in `Account` is saying
 * something. The real answer is a slot on the detail view naming the field,
 * which is a change to a public contract and task 001's to make.
 */
export function headerStatusField(resource: Resource): EnumField | undefined {
  const first = resource.views.detail.sections[0];
  if (!first) return undefined;

  for (const key of first.fields) {
    const field = resource.fields.find((candidate) => candidate.key === key);
    if (field?.type === "enum") return field;
  }
  return undefined;
}

/**
 * The fields one section actually draws.
 *
 * Two are left out. The header's status is promoted rather than repeated — a
 * record's state is one fact and belongs in one place. A `sensitive` field is
 * dropped outright: its value never leaves the API, so a row for it would read
 * as "no value", which is a different and false statement about the record.
 */
export function sectionFields(resource: Resource, section: DetailSection): Field[] {
  const promoted = headerStatusField(resource)?.key;

  return section.fields
    .map((key) => resource.fields.find((field) => field.key === key))
    .filter((field): field is Field => field !== undefined)
    .filter((field) => !field.sensitive && field.key !== promoted);
}

/** One related list, with both ends of the relationship already resolved. */
export interface RelatedList {
  relationship: Relationship;
  /** The resource on the other end, whose table view the list is drawn from. */
  target: Resource;
}

/**
 * The related lists a detail view names, in its order, with the ones it names
 * that no longer exist left out — a definition can outlive the shape it was
 * written against, and half a page is better than none.
 */
export function relatedListsOf(definition: Definition, resource: Resource): RelatedList[] {
  return resource.views.detail.relatedLists.flatMap((key) => {
    const relationship = resource.relationships.find((candidate) => candidate.key === key);
    const target = definition.resources.find((candidate) => candidate.key === relationship?.target);
    return relationship && target ? [{ relationship, target }] : [];
  });
}

/**
 * What a related list is called. The name is the target's, because a
 * relationship carries no display configuration — and it is singular for a
 * `belongsTo`, which points at one record and not at a collection.
 */
export function relatedTitle({ relationship, target }: RelatedList): string {
  return relationship.kind === "belongsTo" ? target.label.singular : target.label.plural;
}

/**
 * The columns a related list draws: the target's own, minus the one the list is
 * narrowed by.
 *
 * A `hasMany` list is exactly "the target's records whose foreign key is this
 * record", so that column holds the same value in every row — the record the
 * operator is already reading, repeated once per line under a heading that has
 * just said it. Nothing is learned from a column that cannot vary, and the
 * width it takes is width the columns that do vary have to give up.
 *
 * A `belongsTo` list is narrowed by the target's own primary key instead, which
 * names the row rather than pointing back at the parent, so it keeps every
 * column. This is the runtime's own arrangement, not a schema question: the
 * target's table view is written for the target's own screen, where that column
 * is worth having.
 */
export function relatedColumns({ relationship, target }: RelatedList): Field[] {
  const columns = target.views.table.columns
    .map((key) => target.fields.find((field) => field.key === key))
    .filter((field): field is Field => field !== undefined);

  if (relationship.kind !== "hasMany") return columns;

  const varying = columns.filter((field) => field.key !== relationship.foreignKey);
  // A list whose every column is the one it was narrowed by has nothing else to
  // show, and a table with no columns is not a quieter table.
  return varying.length > 0 ? varying : columns;
}
