import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "./class-names";
import { ControlShell } from "./control-shell";
import { ChevronDownIcon } from "./icons";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** What the control is asking about. It names the select, and it is shown. */
  label: string;
  /**
   * Whether the value is a choice somebody made. An untouched control says so
   * by staying quiet; a set one comes forward.
   */
  isSet?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A choice out of a fixed set, wearing its label and its value in one control.
 *
 * The control is a real `<select>`: the browser's own popup, keyboard handling
 * and accessible name, none of it re-implemented.
 */
export function Select({ className, label, isSet = true, children, ...props }: SelectProps) {
  return (
    <ControlShell label={label} className={cn("pr-7", className)}>
      <select
        className={cn(
          "appearance-none bg-transparent p-0 outline-none",
          isSet ? "font-medium text-foreground" : "text-muted-foreground",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 size-3 opacity-55" />
    </ControlShell>
  );
}
