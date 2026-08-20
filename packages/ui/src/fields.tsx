import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./class-names";

/**
 * Label and value, paired. It is a real description list, so the pairing is in
 * the markup rather than only in the columns: a screen reader reads "Email,
 * maya@example.com" without being told how the grid was laid out.
 *
 * Both cells share a 20px line box and 8px of air, which lands an ordinary row
 * on the table's own 36px rhythm and lets a long value grow in whole lines.
 */
export function Fields({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return (
    <dl
      data-slot="fields"
      className={cn(
        "grid grid-cols-[minmax(6rem,11rem)_minmax(0,1fr)] overflow-hidden rounded-lg border border-border",
        // The final pair's rule would draw the frame's own edge twice.
        "[&>:nth-last-child(-n+2)]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export interface FieldRowProps {
  /** What the definition calls this field. */
  label: string;
  children: ReactNode;
}

/** One field: what it is called, and what it holds. */
export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <>
      <dt className="border-b border-border py-2 pr-2 pl-2.5 text-small leading-5 text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 border-b border-border py-2 pr-2.5 pl-2 text-body leading-5">{children}</dd>
    </>
  );
}
