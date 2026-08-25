import type { Field, RecordDto, RecordId, RecordValue, RelationValue } from "@repanel/contracts";
import type { QueryResult } from "pg";
import type { SelectEntry } from "../query/columns.js";

/**
 * Postgres types whose text carries no time zone. The driver reads both by
 * building a `Date` out of their parts in this process's local time, so the
 * instant it produces is only meaningful if you take those parts back off it.
 */
const DATE_OID = 1082;
const TIMESTAMP_OID = 1114;

/**
 * Rows into records. What each column holds is read from the query's own select
 * entries rather than from the column names Postgres sends back, because two
 * output columns are allowed to share a name and the driver keeps the last one.
 */
export function toRecordDtos(
  result: QueryResult,
  entries: readonly SelectEntry[],
  identityKey: string,
): RecordDto[] {
  const identity = entries.find((entry) => entry.kind === "value" && entry.key === identityKey);
  if (!identity) throw new Error(`the query does not select the identity field \`${identityKey}\``);

  const types = new Map(result.fields.map((field) => [field.name, field.dataTypeID]));

  return result.rows.map((row: Record<string, unknown>) => {
    const id = row[identity.alias];
    if (id === null || id === undefined) throw new Error("a record came back with no primary key");

    const values: Record<string, RecordValue> = {};
    for (const entry of entries) {
      const raw = row[entry.alias];
      const oid = types.get(entry.alias);

      if (entry.kind === "label") {
        const relation = values[entry.key];
        if (isRelationValue(relation)) relation.label = toLabel(entry.field, raw, oid);
        continue;
      }

      values[entry.key] =
        entry.field.type === "relation"
          ? ({ id: toRecordId(raw), label: null } satisfies RelationValue)
          : toValue(entry.field, raw, oid);
    }

    return { id: toRequiredRecordId(id), values };
  });
}

/** What `count(*)` meant. It arrives as text, because `int8` always does. */
export function toTotal(raw: unknown): number {
  const total = Number(raw);
  if (!Number.isFinite(total)) throw new Error(`a row count came back as \`${String(raw)}\``);
  return total;
}

function toValue(field: Field, raw: unknown, oid: number | undefined): RecordValue {
  if (raw === null || raw === undefined) return null;

  switch (field.type) {
    case "date":
    case "dateTime":
      return raw instanceof Date ? toIsoString(raw, oid) : String(raw);
    case "number":
      return typeof raw === "string" ? toNumber(raw) : (raw as RecordValue);
    default:
      return raw as RecordValue;
  }
}

/**
 * A label is read for the same field type as any other value and then written
 * as text, because that is what a label is: the one line shown in place of a
 * record.
 */
function toLabel(field: Field, raw: unknown, oid: number | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = toValue(field, raw, oid);
  return typeof value === "string" ? value : String(value);
}

/**
 * A `timestamptz` is an instant and the driver read the offset that came with
 * it, so it renders as one. A `date` and a `timestamp` carry no zone at all,
 * and taking their parts back off the `Date` is the only way to answer with the
 * day and the clock the customer stored rather than the ones this process's
 * time zone turns them into.
 */
function toIsoString(value: Date, oid: number | undefined): string {
  if (oid !== DATE_OID && oid !== TIMESTAMP_OID) return value.toISOString();

  const day = `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1, 2)}-${pad(value.getDate(), 2)}`;
  if (oid === DATE_OID) return day;

  const clock = `${pad(value.getHours(), 2)}:${pad(value.getMinutes(), 2)}:${pad(value.getSeconds(), 2)}`;
  return `${day}T${clock}.${pad(value.getMilliseconds(), 3)}`;
}

/**
 * `numeric` and `bigint` arrive as text, and only some of them are numbers a
 * JSON reader would get back unchanged. One that survives the round trip is
 * sent as a number; one that does not keeps the digits the database gave,
 * because rounding somebody's money or truncating their id is not this
 * mapper's decision to make.
 */
function toNumber(raw: string): string | number {
  const parsed = Number(raw);
  return String(parsed) === raw ? parsed : raw;
}

function toRecordId(raw: unknown): RecordId | null {
  if (raw === null || raw === undefined) return null;
  return typeof raw === "number" ? raw : String(raw);
}

function toRequiredRecordId(raw: unknown): RecordId {
  return typeof raw === "number" ? raw : String(raw);
}

function isRelationValue(value: RecordValue | undefined): value is RelationValue {
  return typeof value === "object" && value !== null && "label" in value;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
