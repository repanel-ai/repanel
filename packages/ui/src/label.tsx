import type { LabelHTMLAttributes } from "react";
import { cn } from "./class-names";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/** Names the field it points at. */
export function Label({ className, ...props }: LabelProps) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...props} />
  );
}
