import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./class-names";

/**
 * The table primitives: a real `<table>`, with the rhythm the design fixes
 * (34px head, 36px rows, 10px gutters) and no opinion about what is in it.
 *
 * `border-separate` rather than the collapsed default because the header is
 * sticky, and a collapsed border belongs to the table rather than to the cell —
 * so it stays behind while the header travels, and the header arrives at the
 * next row with nothing under it.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      data-slot="table"
      className={cn("w-full border-separate border-spacing-0 text-body", className)}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      data-slot="table-body"
      // The last row's rule would draw the frame's own edge twice.
      className={cn("[&_tr:last-child>td]:border-b-0", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    // No transition, and it is the rule rather than an omission: a row is data,
    // and data does not move (DESIGN.md §12). The hover highlight lands the
    // moment the pointer is over the row, which is what makes a list of two
    // hundred of them scannable rather than soft.
    <tr
      data-slot="table-row"
      className={cn(
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "sticky top-0 z-10 h-head border-b border-border bg-background px-2.5",
        "text-left align-middle text-small font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      data-slot="table-cell"
      className={cn("h-row border-b border-border px-2.5 align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}
