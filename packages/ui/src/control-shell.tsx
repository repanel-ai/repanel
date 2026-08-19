import type { ComponentProps } from "react";
import { cn } from "./class-names";

export interface ControlShellProps extends ComponentProps<"label"> {
  /** What the control is asking about. It names the control, and it is shown. */
  label: string;
}

/**
 * A control that wears its label: the question on the left, the answer in the
 * control beside it, inside one bordered box. Everything that narrows a table
 * uses it, so a filter's value is always read where the filter is set — never
 * repeated somewhere else, and never shown without saying what it answers.
 *
 * It is a real `<label>`, so the control inside is named by it and reached by
 * clicking it, with nothing re-implemented.
 */
export function ControlShell({ label, className, children, ...props }: ControlShellProps) {
  return (
    <label
      data-slot="control-shell"
      className={cn(
        "relative inline-flex h-control items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-body",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/45",
        className,
      )}
      {...props}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
