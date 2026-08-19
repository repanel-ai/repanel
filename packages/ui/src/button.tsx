import type { ButtonHTMLAttributes } from "react";
import { cn } from "./class-names";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** The primary action on a screen. */
export function Button({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4",
        "text-sm font-medium text-primary-foreground transition-colors",
        "hover:bg-primary/90",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
