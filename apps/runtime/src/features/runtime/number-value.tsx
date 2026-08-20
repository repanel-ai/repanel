import type { RecordValue } from "@repanel/contracts";

export interface NumberValueProps {
  value: RecordValue;
  /** Whether this number addresses the record rather than measures something. */
  isIdentity: boolean;
}

/**
 * A number, said as what it is. A quantity gets the reader's grouping so it can
 * be taken in at a glance; an identity gets none, because it is a name that
 * happens to be digits and `1,024` is not what anyone typed into a ticket.
 */
export function NumberValue({ value, isIdentity }: NumberValueProps) {
  return <span className="font-data">{format(value, isIdentity)}</span>;
}

function format(value: RecordValue, isIdentity: boolean): string {
  if (isIdentity || typeof value !== "number") return String(value);
  return value.toLocaleString();
}
