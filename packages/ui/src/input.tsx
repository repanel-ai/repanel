import type { InputHTMLAttributes } from "react";
import { cn } from "./class-names";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** A single-line field. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-background px-3",
        "text-sm text-foreground placeholder:text-muted-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
