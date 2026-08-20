import type { RecordValue, RelationValue } from "@repanel/contracts";
import { NoValue, Relation } from "@repanel/ui";
import { Link } from "react-router";
import { runtimeRoutes } from "./routes";

export interface RelationLinkProps {
  projectKey: string;
  /** The resource key the relation points at. */
  target: string;
  value: RecordValue;
}

/**
 * A value that belongs to another record: the signature, and the way there.
 * It is drawn identically wherever a relation appears — table cell, detail
 * field, related list — because that is what makes the dotted rule mean
 * something (DESIGN.md §5).
 *
 * The click is kept from whatever surrounds it: a row is on its way somewhere
 * else, and a link inside it answers for itself.
 */
export function RelationLink({ projectKey, target, value }: RelationLinkProps) {
  const relation = asRelation(value);
  if (!relation || relation.id === null) return <NoValue />;

  // A record whose label could not be read is still a record; its key names it,
  // the same fallback the definition itself makes when no label field is set.
  const label = relation.label ?? String(relation.id);

  return (
    <Link
      to={runtimeRoutes.record(projectKey, target, relation.id)}
      onClick={(event) => event.stopPropagation()}
      className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
    >
      <Relation>{label}</Relation>
    </Link>
  );
}

function asRelation(value: RecordValue): RelationValue | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Partial<RelationValue>;
  return "id" in candidate && "label" in candidate ? (candidate as RelationValue) : undefined;
}
