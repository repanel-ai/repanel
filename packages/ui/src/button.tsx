import type { ComponentProps } from "react";
import { cn } from "./class-names";

/** How much of the screen's voice a button gets. */
export type ButtonVariant = "primary" | "outline" | "ghost";
export type ButtonSize = "default" | "icon";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border-input bg-background hover:bg-accent",
  ghost: "hover:bg-accent",
};

const SIZES: Record<ButtonSize, string> = {
  default: "px-3",
  icon: "w-control px-0",
};

/** Something to press. */
export function Button({
  className,
  type = "button",
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(
        "inline-flex h-control shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent",
        "text-body font-medium whitespace-nowrap transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
