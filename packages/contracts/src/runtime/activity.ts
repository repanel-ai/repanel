import type { JsonValue } from "./records.js";

/**
 * What a recorded event was. The three are the whole of what RePanel can do to
 * a customer's data: run an action the definition declares, make a record, or
 * change one. There is no `read` here and there is not meant to be — an admin
 * that logged every page an operator opened would bury the three things that
 * changed something under ten thousand that did not.
 */
export const AUDIT_KINDS = ["action", "create", "update"] as const;

export type AuditKind = (typeof AUDIT_KINDS)[number];

/**
 * How it ended, in three answers because they are three different things to do
 * about it.
 *
 * `ok` — it happened. `refused` — something declined it, and asking again the
 * same way gets the same answer: a unique constraint, a value the definition
 * does not accept, a record that is not there, an application that said no.
 * `failed` — it did not complete and nobody decided that: a database that ran
 * out of time, an application that could not be reached.
 */
export const AUDIT_OUTCOMES = ["ok", "refused", "failed"] as const;

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/**
 * The field values one event carries, keyed by field.
 *
 * They are plain column values on both sides of a write: a relation is the key
 * it was written with rather than the name of the record on the other end.
 * A label is what a record is *called now*, and what a record was called at
 * some point last month is not something an audit log can answer honestly.
 *
 * A `sensitive` field is never in here. That is not a rule this type states —
 * it is a property of the only two statements that can fill it, which select
 * the columns a write names and drop a sensitive one where every other read
 * does (`columns.ts`).
 */
export type AuditValues = Readonly<Record<string, JsonValue>>;

/**
 * One thing that was done to one record, as the admin shows it back.
 *
 * The actor is an email rather than an id because that is who a second operator
 * reading this needs to recognise, and it is the address as it stood when the
 * event was filed — a person who changes their email does not thereby change
 * what the log says about last Tuesday.
 */
export interface ActivityEventDto {
  id: string;
  kind: AuditKind;
  /** The action's key, for an `action`; null for a form write. */
  actionKey: string | null;
  /** Who did it, as they were called at the time. */
  actorEmail: string;
  outcome: AuditOutcome;
  /**
   * Which refusal, or which failure, in the same categories the request itself
   * was answered with (`conflict`, `action_rejected`, `query_timeout`, …).
   * Null when the outcome is `ok`.
   */
  reason: string | null;
  /** The fields the write touched, as they stood before it. Null for a create,
   *  and for anything that never reached a statement. */
  before: AuditValues | null;
  /** The same fields, as the write left them. */
  after: AuditValues | null;
  /** ISO 8601, from the control plane's own clock. */
  at: string;
}

/** A page of one record's events, newest first. */
export interface ActivityListDto {
  events: ActivityEventDto[];
  total: number;
  page: number;
  pageSize: number;
}
