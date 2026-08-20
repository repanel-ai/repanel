import { cn } from "./class-names";

/**
 * There is nothing here — and it is said, not left out. A blank space is
 * indistinguishable from a cell that failed to render, so the absence gets a
 * mark of its own; it also reads differently from a `no` and from a `0`, both
 * of which are values somebody stored.
 */
export function NoValue({ className }: { className?: string }) {
  return (
    <span className={cn("text-muted-foreground", className)} title="No value">
      —
    </span>
  );
}
