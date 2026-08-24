import { cn } from "./class-names";
import { ChevronDownIcon } from "./icons";

export interface JsonBlockProps {
  /** The value as it arrived. Nothing here changes it; it is read, not edited. */
  value: unknown;
  className?: string;
}

/**
 * A structured value, closed by default and readable when opened. Closed it is
 * one line — enough to recognise the shape without giving a blob the height of
 * a paragraph; opened it is the value pretty-printed in the data face, which is
 * the form anyone who needs it is going to copy out of.
 *
 * The disclosure is the browser's own `<details>`: it opens, closes, takes
 * focus and answers the keyboard without a line of that being written here.
 */
export function JsonBlock({ value, className }: JsonBlockProps) {
  return (
    <details data-slot="json-block" className={cn("group min-w-0", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none",
          "[&::-webkit-details-marker]:hidden focus-visible:ring-3 focus-visible:ring-ring/45",
        )}
      >
        {/* The chevron turns without travelling: this is a value on a record,
            and §12 gives a data surface no motion — not even a rotation. */}
        <ChevronDownIcon className="size-3 shrink-0 -rotate-90 text-muted-foreground group-open:rotate-0" />
        <span className="truncate font-data text-muted-foreground">{oneLine(value)}</span>
      </summary>
      <pre className="mt-1.5 overflow-x-auto rounded-md bg-accent p-2.5 font-data text-small leading-5">
        {pretty(value)}
      </pre>
    </details>
  );
}

/** `undefined` cannot survive `JSON.stringify`, and nothing may render blank. */
function oneLine(value: unknown): string {
  return JSON.stringify(value) ?? "null";
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "null";
}
