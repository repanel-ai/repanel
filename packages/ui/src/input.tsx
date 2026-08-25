import type { ComponentProps } from "react";
import { cn } from "./class-names";

/** `ComponentProps` rather than the attribute list: a caller may hold a ref. */
export type InputProps = ComponentProps<"input">;

/** A single-line field. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-control w-full min-w-0 rounded-md border border-input bg-background px-3",
        "text-body text-foreground outline-none placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
        "disabled:opacity-50",
        // The browser draws its own calendar mark on a date or a time field.
        // It is dressed like the chevron it sits beside rather than left at the
        // weight the browser picked, and it is styled here so that every date
        // control in the product gets it without asking.
        "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
        "[&::-webkit-calendar-picker-indicator]:opacity-55",
        "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
        className,
      )}
      {...props}
    />
  );
}
