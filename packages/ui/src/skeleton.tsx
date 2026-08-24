import type { HTMLAttributes } from "react";
import { cn } from "./class-names";

/**
 * The shape of something that has not arrived. It is hidden from assistive
 * technology on purpose: a screen full of blocks has nothing to say, and the
 * surface that is waiting says it once, in words.
 *
 * It does not pulse. A skeleton stands where a record is about to be, which
 * makes it a data surface, and a data surface does not move (DESIGN.md §12) —
 * a shimmer would also be the only thing on the screen animating while the one
 * thing an operator is actually waiting for stays still.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-md bg-accent", className)}
      {...props}
    />
  );
}
