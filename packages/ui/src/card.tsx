import type { HTMLAttributes } from "react";
import { cn } from "./class-names";

export type CardProps = HTMLAttributes<HTMLDivElement>;

/** A surface raised off the page. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface p-6", className)}
      {...props}
    />
  );
}
