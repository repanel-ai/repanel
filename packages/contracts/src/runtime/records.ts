import { z } from "zod";

/** How the admin addresses one record: whatever its primary key holds. */
export type RecordId = string | number;

/**
 * The same thing, for the one place a record id arrives as a value rather than
 * as a path segment: a connector frame, which is JSON and can therefore carry
 * the number a numeric key actually is. A route still spells it as text — a URL
 * has nothing else — and the engine binds either as a parameter regardless.
 */
export const recordIdSchema: z.ZodType<RecordId> = z.union([z.string().min(1), z.number()]);

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

/**
 * One record, offered as something to point at: the key a relation would be
 * written with, and what the record is called. The label is the target's
 * `labelField` — the same one a relation cell reads — and is null where the
 * record has no name of its own.
 */
export interface RecordOptionDto {
  id: RecordId;
  label: string | null;
}
