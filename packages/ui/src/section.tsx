import type { ReactNode } from "react";
import { cn } from "./class-names";

export interface SectionProps {
  /** What this group of facts is called. */
  title: string;
  /** A count or a note, said beside the title the way a page says its total. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A named group on a screen: the heading, then whatever is being grouped. The
 * heading sits above its frame rather than inside one, which is what the page
 * title already does above the table — so a section of fields and a list of
 * related records are introduced the same way.
 */
export function Section({ title, meta, children, className }: SectionProps) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-body font-medium">{title}</h2>
        {meta !== undefined && <span className="text-small text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
