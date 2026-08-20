import type { DetailSection, Field, Resource } from "@repanel/contracts";

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
