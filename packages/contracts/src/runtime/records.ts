/** How the admin addresses one record: whatever its primary key holds. */
export type RecordId = string | number;

/** Anything a `json` field can carry, which is the outer bound of any value. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * What a `relation` field carries: the record it points at, and what to read
 * in place of the key. The label is the target's `labelField`, and is null when
 * the row it points at is not there.
 */
export interface RelationValue {
  id: RecordId | null;
  label: string | null;
}

/**
 * One field's value, JSON and nothing but JSON. Dates arrive as ISO strings; a
 * `number` arrives as a number unless it could not be one without losing
 * digits, in which case it keeps the text the database gave.
 */
export type RecordValue = JsonValue | RelationValue;

/** One record, as the runtime returns it. Sensitive fields are never in here. */
export interface RecordDto {
  id: RecordId;
  /** Field key to value, in the order the view declares. */
  values: Record<string, RecordValue>;
}

/** A page of records, and how many there are to page through. */
export interface RecordListDto {
  records: RecordDto[];
  total: number;
  page: number;
  pageSize: number;
}
