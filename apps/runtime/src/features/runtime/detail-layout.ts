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
