import type { HTMLAttributes } from "react";
import { cn } from "./class-names";

/**
 * How grave a state is. The vocabulary is the definition's own (DECISIONS
 * #029) rather than a set of visual names, so nothing has to translate between
 * what a customer wrote down and what is drawn.
 *
 * All four share border, padding, radius and size; only fill and text colour
 * differ, and their contrasts are matched — so no state shouts louder than its
 * peers (DESIGN.md §4).
 */
export type BadgeTone = "neutral" | "positive" | "attention" | "critical";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Absent is `neutral`: a value the definition says nothing about is quiet. */
  tone?: BadgeTone;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  positive: "border-positive-line bg-positive-soft text-positive-text",
  attention: "border-attention-line bg-attention-soft text-attention-text",
  critical: "border-destructive-line bg-destructive-soft text-destructive-text",
};

/**
 * One value out of a fixed set. The default is the quiet treatment: a badge
 * only speaks up when something that knows the domain says it should, and
 * nothing may infer that from how a value is spelled.
 */
export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-[7px] py-px",
        "text-micro leading-[1.5] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
