import type { Field, RecordValue, RelationValue } from "@repanel/contracts";
import { Badge, CheckIcon, CircleIcon, Relation } from "@repanel/ui";
import { Link } from "react-router";
import { runtimeRoutes } from "./routes";

export interface RecordCellProps {
  projectKey: string;
  /** What the definition says this value is. Nothing else decides. */
  field: Field;
  value: RecordValue;
  /** Whether this column is the record's own key rather than a value about it. */
  isIdentity: boolean;
}

/**
 * One value, said the way its type is said everywhere else in the admin. The
 * field's type is the only input: no column is special-cased, and no value's
 * spelling is read for meaning.
 */
export function RecordCell({ projectKey, field, value, isIdentity }: RecordCellProps) {
  if (value === null || value === undefined) return <Empty />;

  switch (field.type) {
    case "enum":
      // The severity is the definition's to state and nobody else's: a value
      // the `tones` map does not mention stays quiet, and the spelling of a
      // value is never read for meaning (DECISIONS #029).
      return <Badge tone={field.tones[String(value)]}>{String(value)}</Badge>;

    case "relation":
      return <RelationCell projectKey={projectKey} target={field.target} value={value} />;

    case "boolean":
      return value === true ? <Mark yes /> : <Mark />;

    case "date":
    case "dateTime":
      return <DateCell value={String(value)} withTime={field.type === "dateTime"} />;

    case "number":
      return <span className="font-data">{formatNumber(value, isIdentity)}</span>;

    case "json":
      return (
        <span className="block max-w-[22rem] truncate font-data text-muted-foreground">
          {JSON.stringify(value)}
        </span>
      );

    case "longText":
      return (
        <span className="block max-w-[22rem] truncate" title={String(value)}>
          {String(value)}
        </span>
      );

    default:
      return <span className={machineFaced(field, isIdentity)}>{String(value)}</span>;
  }
}

/**
 * A value that belongs to another record: the signature, and a way to get
 * there. The click is stopped from reaching the row, which is on its way
 * somewhere else.
 */
function RelationCell({
  projectKey,
  target,
  value,
}: {
  projectKey: string;
  target: string;
  value: RecordValue;
}) {
  const relation = asRelation(value);
  if (!relation || relation.id === null) return <Empty />;

  // A record whose label could not be read is still a record; its key names it,
  // the same fallback the definition itself makes when no label field is set.
  const label = relation.label ?? String(relation.id);

  return (
    <Link
      to={runtimeRoutes.record(projectKey, target, relation.id)}
      onClick={(event) => event.stopPropagation()}
      className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
    >
      <Relation>{label}</Relation>
    </Link>
  );
}

/** The day, in one shape, with the exact moment a hover away. */
function DateCell({ value, withTime }: { value: string; withTime: boolean }) {
  const zoned = ZONED.test(value);
  const at = new Date(zoned || !CLOCK.test(value) ? value : `${value}Z`);
  if (Number.isNaN(at.getTime())) return <span className="font-data">{value}</span>;

  return (
    <time dateTime={value} title={exactly(at, withTime, zoned)} className="font-data text-muted-foreground">
      {DAY.format(at)}
    </time>
  );
}

/** A value that names its offset, or ends in `Z`. */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;
/** A value that carries a time of day at all — a `date` is only a day. */
const CLOCK = /^\d{4}-\d{2}-\d{2}T/;

/**
 * One shape for every date on every screen: a column whose dates change shape
 * with the reader's locale is not a column anyone can scan, and UTC is the only
 * clock two operators in two places agree on.
 *
 * Every value is formatted in UTC — including the ones that arrive without a
 * zone, which are read as UTC above precisely so they are *not* moved. The API
 * strips the zone from a `timestamp` column on purpose (records.mapper), so its
 * digits are the customer's own clock; putting this process's offset back into
 * them would show a day nobody stored.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function exactly(at: Date, withTime: boolean, zoned: boolean): string {
  const iso = at.toISOString();
  if (!withTime) return iso.slice(0, 10);
  // A value that carried no zone is not a UTC reading, and saying so would be
  // claiming an offset the column does not have.
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}${zoned ? " UTC" : ""}`;
}

/** Yes and no, drawn. The word `true` is a database's answer, not an admin's. */
function Mark({ yes = false }: { yes?: boolean }) {
  const Glyph = yes ? CheckIcon : CircleIcon;
  return (
    <span className={yes ? "text-foreground" : "text-muted-foreground"}>
      <Glyph className="inline-block size-3.5" />
      <span className="sr-only">{yes ? "Yes" : "No"}</span>
    </span>
  );
}

/** There is nothing here — which is different from a `no` and from a `0`. */
function Empty() {
  return (
    <span className="text-muted-foreground" title="No value">
      —
    </span>
  );
}

/**
 * Machine-shaped values — keys, addresses, timestamps, quantities — are set in
 * the data face; prose is not. The face itself is a token, so which face that
 * is stays one decision (DESIGN.md BUILD REQUIREMENT 5).
 */
const MACHINE_TYPES: ReadonlyArray<Field["type"]> = ["email", "url", "number", "date", "dateTime", "json"];

function machineFaced(field: Field, isIdentity: boolean): string {
  return isIdentity || MACHINE_TYPES.includes(field.type) ? "font-data" : "";
}

/** An id is a name that happens to be digits; a quantity is a number. */
function formatNumber(value: RecordValue, isIdentity: boolean): string {
  if (isIdentity || typeof value !== "number") return String(value);
  return value.toLocaleString();
}

function asRelation(value: RecordValue): RelationValue | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Partial<RelationValue>;
  return "id" in candidate && "label" in candidate ? (candidate as RelationValue) : undefined;
}
