import type { ReactNode } from "react";
import { cn } from "./class-names";

/**
 * A row of destinations, drawn as tabs. It is a `<nav>` of real links rather
 * than a tab widget, because each panel has an address: the browser already
 * owns the back button, the middle click and the keyboard, and a tab that is
 * a link needs none of that written again.
 */
export function TabBar({
  label,
  children,
  className,
}: {
  /** What this row of destinations is for, for anyone who cannot see it. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("flex-none border-b border-border", className)}>
      <ul className="flex list-none gap-4 p-0">{children}</ul>
    </nav>
  );
}

/**
 * What a tab looks like. Separate from the bar so the link itself stays the
 * router's, and so the classes are written once (as `buttonClasses` is).
 *
 * The current tab is marked by a rule sitting on the bar's own hairline, which
 * is a line the eye already has — no fill, and no colour the rest of the screen
 * does not use.
 */
export function tabClasses(isCurrent: boolean, className?: string): string {
  return cn(
    "-mb-px inline-flex h-head items-center border-b-2 text-body font-medium whitespace-nowrap",
    "rounded-t-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
    isCurrent
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
    className,
  );
}
