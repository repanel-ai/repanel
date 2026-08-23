import type { ReactNode } from "react";

/**
 * What a page is called, and one line about it. The same shape the runtime's
 * table page uses for a resource's name and its record count (DESIGN.md §3):
 * the title at `--t-title` and nothing else at that size.
 */
export function PageHead({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h1 className="text-title font-medium">{title}</h1>
      {meta !== undefined && <span className="text-small text-muted-foreground">{meta}</span>}
    </div>
  );
}
