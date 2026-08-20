import { cn } from "@repanel/ui";

export interface DateValueProps {
  /** The value exactly as the API sent it. */
  value: string;
  /** Whether the field carries a time of day at all — a `date` is only a day. */
  hasTime: boolean;
  /**
   * Whether the clock is printed beside the day. A column has no room for it
   * and keeps it on hover; a detail field has room, and the moment is often
   * the reason somebody opened the record.
   */
  showClock?: boolean;
  className?: string;
}

/**
 * One shape for every date on every screen: a column whose dates change shape
 * with the reader's locale is not a column anyone can scan, and UTC is the only
 * clock two operators in two places agree on (DECISIONS #030).
 *
 * Every value is formatted in UTC — including the ones that arrive without a
 * zone, which are read as UTC below precisely so they are *not* moved. The API
 * strips the zone from a `timestamp` column on purpose (records.mapper), so its
 * digits are the customer's own clock; putting this process's offset back into
 * them would show a day nobody stored.
 */
export function DateValue({ value, hasTime, showClock = false, className }: DateValueProps) {
  const zoned = ZONED.test(value);
  const at = new Date(zoned || !CLOCK.test(value) ? value : `${value}Z`);
  if (Number.isNaN(at.getTime())) return <span className={cn("font-data", className)}>{value}</span>;

  return (
    <time dateTime={value} title={exactly(at, hasTime, zoned)} className={cn("font-data", className)}>
      {DAY.format(at)}
      {hasTime && showClock && <span className="ml-1.5 text-muted-foreground">{clock(at, zoned)}</span>}
    </time>
  );
}

/** A value that names its offset, or ends in `Z`. */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;
/** A value that carries a time of day at all — a `date` is only a day. */
const CLOCK = /^\d{4}-\d{2}-\d{2}T/;

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function exactly(at: Date, hasTime: boolean, zoned: boolean): string {
  const iso = at.toISOString();
  if (!hasTime) return iso.slice(0, 10);
  return `${iso.slice(0, 10)} ${clock(at, zoned)}`;
}

/**
 * A value that carried no zone is not a UTC reading, and saying `UTC` would be
 * claiming an offset the column does not have.
 */
function clock(at: Date, zoned: boolean): string {
  const iso = at.toISOString();
  return `${iso.slice(11, 16)}${zoned ? " UTC" : ""}`;
}
