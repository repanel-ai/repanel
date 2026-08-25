import type { ReactNode, SelectHTMLAttributes } from "react";
import type { BadgeTone } from "./badge";
import { cn } from "./class-names";
import { ControlShell } from "./control-shell";
import { ChevronDownIcon } from "./icons";
import { TONE_INK } from "./tone-ink";

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

export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * How grave the value on show is, out of the badge language's own vocabulary
   * (DECISIONS #029). Absent — and `neutral` — is the ordinary ink every other
   * control is set in.
   */
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

/**
 * A choice out of a fixed set, on a form. It is `Select`'s sibling and not its
 * variant: a filter wears its own label inside the control because it has
 * nowhere else to say what it answers, and a form field is already named by the
 * row it sits in.
 *
 * The control is a real `<select>`: the browser's own popup, keyboard handling
 * and accessible name, none of it re-implemented.
 */
export function FormSelect({ className, tone = "neutral", children, ...props }: FormSelectProps) {
  return (
    <div className="relative flex w-full min-w-0 items-center">
      <select
        data-slot="form-select"
        data-tone={tone}
        className={cn(
          "h-control w-full min-w-0 appearance-none rounded-md border border-input bg-background",
          "pr-8 pl-3 text-body font-medium outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
          "disabled:opacity-50",
          TONE_INK[tone],
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 size-3 opacity-55" />
    </div>
  );
}
