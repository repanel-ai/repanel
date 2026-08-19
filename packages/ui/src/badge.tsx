import type { HTMLAttributes } from "react";
import { cn } from "./class-names";

/**
 * How loudly a state is said — never what the state means. All three share
 * border, padding, radius and size, so no state shouts louder than its peers;
 * only fill weight and text colour differ.
 */
export type BadgeTreatment = "quiet" | "outline" | "tinted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  treatment?: BadgeTreatment;
}

const TREATMENTS: Record<BadgeTreatment, string> = {
  quiet: "border-border bg-secondary text-secondary-foreground",
  outline: "border-input text-foreground",
  tinted: "border-destructive-line bg-destructive-soft text-destructive-text",
};

/**
 * One value out of a fixed set. The default is the quiet treatment: a badge
 * only speaks up when something that knows the domain says it should, and
 * nothing may infer that from how a value is spelled.
 */
export function Badge({ className, treatment = "quiet", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-treatment={treatment}
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-[7px] py-px",
        "text-micro leading-[1.5] font-medium whitespace-nowrap",
        TREATMENTS[treatment],
        className,
      )}
      {...props}
    />
  );
}
