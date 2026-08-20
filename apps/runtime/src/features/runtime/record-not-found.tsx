import type { Resource } from "@repanel/contracts";
import { EmptyPanel, buttonClasses } from "@repanel/ui";
import { Link, type To } from "react-router";

export interface RecordNotFoundProps {
  resource: Resource;
  /** Where the operator was before they came here. */
  back: To;
}

/**
 * The address names a record that is not there. That is not an error — nothing
 * failed — so it is not said in the alarm's colours; it is a surface with
 * nothing on it, and the way back is on it.
 */
export function RecordNotFound({ resource, back }: RecordNotFoundProps) {
  const singular = resource.label.singular.toLowerCase();

  return (
    <div className="rounded-lg border border-border">
      <EmptyPanel
        title={`This ${singular} is not here`}
        description={`Nothing in ${resource.label.plural} answers to that address. The record may have been deleted, or the link may be wrong.`}
        action={
          <Link to={back} className={buttonClasses({ variant: "outline" })}>
            Back to {resource.label.plural}
          </Link>
        }
      />
    </div>
  );
}
