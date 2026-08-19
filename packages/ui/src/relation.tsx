import type { HTMLAttributes } from "react";
import { cn } from "./class-names";

/**
 * The signature, and the only place it is written.
 *
 * A relation is the one value on a surface that belongs to a *different*
 * record. The dotted rule says so, and says it identically wherever a relation
 * appears — table cell, detail field, related list, breadcrumb, filter value.
 * Dotted rather than solid because a solid underline is already spoken for by
 * links, and the distinction has to survive being seen a thousand times a day.
 *
 * It marks relations and nothing else. Putting it on a value this record owns
 * would be a lie told in the one place the product asks to be trusted.
 */
export function Relation({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="relation"
      className={cn(
        "underline decoration-muted-foreground decoration-dotted decoration-1 underline-offset-[3px]",
        "hover:decoration-current",
        className,
      )}
      {...props}
    />
  );
}
