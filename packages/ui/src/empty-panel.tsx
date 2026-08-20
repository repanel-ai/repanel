import type { ReactNode } from "react";
import { cn } from "./class-names";

export interface EmptyPanelProps {
  /** What is not here, in three or four words. */
  title: string;
  /** Why, or what to do about it. */
  description: string;
  /** The way on, when there is one. */
  action?: ReactNode;
  className?: string;
}

/**
 * A surface with nothing on it, said properly: what is missing, why, and the
 * way out. Every nothing in the admin is drawn here, so an empty table and a
 * record that is not there are recognisably the same kind of answer.
 */
export function EmptyPanel({ title, description, action, className }: EmptyPanelProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 px-4 py-14 text-center", className)}>
      <p className="text-body font-medium">{title}</p>
      <p className="max-w-sm text-body text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
