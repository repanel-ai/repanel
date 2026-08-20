import type { Field, RecordValue } from "@repanel/contracts";
import { Badge, CheckIcon, CircleIcon, NoValue } from "@repanel/ui";
import { DateValue } from "./date-value";
import { NumberValue } from "./number-value";
import { RelationLink } from "./relation-link";

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
  if (value === null || value === undefined) return <NoValue />;

  switch (field.type) {
    case "enum":
      // The severity is the definition's to state and nobody else's: a value
      // the `tones` map does not mention stays quiet, and the spelling of a
      // value is never read for meaning (DECISIONS #029).
      return <Badge tone={field.tones[String(value)]}>{String(value)}</Badge>;

    case "relation":
      return <RelationLink projectKey={projectKey} target={field.target} value={value} />;

    case "boolean":
      return value === true ? <Mark yes /> : <Mark />;

    case "date":
    case "dateTime":
      return (
        <DateValue
          value={String(value)}
          hasTime={field.type === "dateTime"}
          className="text-muted-foreground"
        />
      );

    case "number":
      return <NumberValue value={value} isIdentity={isIdentity} />;

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

/**
 * Machine-shaped values — keys, addresses, timestamps, quantities — are set in
 * the data face; prose is not. The face itself is a token, so which face that
 * is stays one decision (DESIGN.md BUILD REQUIREMENT 5).
 */
const MACHINE_TYPES: ReadonlyArray<Field["type"]> = ["email", "url", "number", "date", "dateTime", "json"];

function machineFaced(field: Field, isIdentity: boolean): string {
  return isIdentity || MACHINE_TYPES.includes(field.type) ? "font-data" : "";
}
