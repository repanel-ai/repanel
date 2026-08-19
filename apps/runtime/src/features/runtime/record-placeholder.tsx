import type { Definition } from "@repanel/contracts";
import { useParams } from "react-router";

/** Where a row leads until task 011 builds the detail view. */
export function RecordPlaceholder({ definition }: { definition: Definition }) {
  const { resourceKey = "", recordId = "" } = useParams();
  const resource = definition.resources.find((candidate) => candidate.key === resourceKey);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pt-3.5 pb-3">
      <h1 className="text-title font-semibold tracking-[-0.02em]">
        {resource?.label.singular ?? resourceKey}
      </h1>
      <p className="text-body text-muted-foreground">
        Record <span className="font-data text-foreground">{recordId}</span>. The detail view
        arrives in task 011.
      </p>
    </div>
  );
}
