import type { HTMLAttributes } from "react";
import { cn } from "./class-names";

/**
 * The shape of something that has not arrived. It is hidden from assistive
 * technology on purpose: a screen full of pulsing blocks has nothing to say,
 * and the surface that is waiting says it once, in words.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}
