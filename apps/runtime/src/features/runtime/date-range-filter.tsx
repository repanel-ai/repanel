import type { DateRangeFilter as DateRange } from "@repanel/contracts";
import { ChevronDownIcon, Input, cn } from "@repanel/ui";
import { useRef } from "react";

export interface DateRangeFilterProps {
  label: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  /**
   * Whether the column carries a time as well as a day. It does not change what
   * is picked — a day — only where that day ends: `to` on a timestamp column
   * means the end of that day, or an operator asking for "up to today" is told
   * today has nothing in it.
   */
  hasTime: boolean;
}

/**
 * Two ends of a range, behind the trigger that shows them. The disclosure is
 * the browser's own: a `<details>` opens, closes, takes focus and answers the
 * keyboard without a line of that being written here.
 */
export function DateRangeFilter({ label, value, onChange, hasTime }: DateRangeFilterProps) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const isSet = Boolean(value?.from || value?.to);

  const close = () => {
    if (disclosure.current) disclosure.current.open = false;
  };

  const edit = (end: "from" | "to", day: string) => {
    const next: DateRange = { ...value };
    if (day === "") delete next[end];
    else next[end] = end === "to" && hasTime ? `${day}T23:59:59.999Z` : day;

    onChange(next.from || next.to ? next : undefined);
  };

  return (
    <details
      ref={disclosure}
      className="group relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      onBlur={(event) => {
        if (!disclosure.current?.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <summary
        className={[
          "flex h-control cursor-pointer list-none items-center gap-1.5 rounded-md border border-input",
          "bg-background pr-7 pl-2.5 text-body outline-none [&::-webkit-details-marker]:hidden",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
        ].join(" ")}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className={isSet ? "font-medium text-foreground" : "text-muted-foreground"}>
          {describe(value)}
        </span>
        <ChevronDownIcon className="pointer-events-none absolute right-2.5 size-3 opacity-55" />
      </summary>

      {/*
        * The panel arrives the way every other surface that was not on the
        * screen does (DESIGN.md §12). The animation hangs off the disclosure's
        * own `open`, so it is applied at the moment the panel opens rather than
        * sitting on a hidden element waiting to replay — and closing removes it
        * with nothing to play, which is the whole of "enters only".
        */}
      <div className="absolute z-20 mt-1 flex w-60 flex-col gap-2 rounded-lg border border-border bg-card p-2.5 group-open:animate-enter">
        <label className="flex items-center justify-between gap-2 text-small text-muted-foreground">
          From
          <DayInput value={value?.from?.slice(0, 10) ?? ""} onChange={(day) => edit("from", day)} />
        </label>
        <label className="flex items-center justify-between gap-2 text-small text-muted-foreground">
          To
          <DayInput value={value?.to?.slice(0, 10) ?? ""} onChange={(day) => edit("to", day)} />
        </label>
        {isSet && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              close();
            }}
            className="self-start text-small text-muted-foreground underline underline-offset-[3px] transition-colors hover:text-foreground"
          >
            Clear {label.toLowerCase()}
          </button>
        )}
      </div>
    </details>
  );
}

/**
 * One end of the range. The control underneath stays the browser's own date
 * input — its picker, its keyboard, its parsing, none of it re-implemented —
 * and everything around it spends the tokens every other control spends: the
 * data face a date is set in, the muted-until-set voice the selects use, and
 * `Input`'s own dressing of the browser's calendar mark.
 */
function DayInput({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  return (
    <Input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "w-36 px-2.5 font-data",
        // An empty date input shows `dd/mm/yyyy`, which is a placeholder and
        // reads as one; a date somebody picked comes forward.
        value === "" ? "text-muted-foreground" : "text-foreground",
      )}
    />
  );
}

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function describe(value: DateRange | undefined): string {
  if (!value?.from && !value?.to) return "Any time";
  if (value.from && value.to) return `${day(value.from)} – ${day(value.to)}`;
  return value.from ? `From ${day(value.from)}` : `Until ${day(value.to)}`;
}

function day(value: string | undefined): string {
  const at = new Date(String(value));
  return Number.isNaN(at.getTime()) ? String(value) : DAY.format(at);
}
