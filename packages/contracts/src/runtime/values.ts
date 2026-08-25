import { z } from "zod";
import { formatList, type ValidationError } from "../definition/errors.js";
import { isWritableType, type Field } from "../definition/fields.js";
import { primaryKeyGenerationOf, type Resource } from "../definition/schema.js";
import type { JsonValue } from "./records.js";

/** Which write a submission is: the two differ only in what may be left out. */
export type WriteMode = "create" | "update";

/** The values half of a write, as it arrives on the wire. */
export type RecordValues = Readonly<Record<string, JsonValue>>;

/** Where a problem with a submitted value is reported: `values.<field key>`. */
const VALUES_PATH = "values";

/** Types whose value is a line of text, and for which `""` is not an answer. */
const TEXT_TYPES: ReadonlySet<string> = new Set(["text", "longText", "email", "url"]);

const emailSchema = z.email();

/**
 * Whether a submission may be written to a record of this resource, in this
 * package's own error shape (DECISIONS #008) — a path, what is wrong, what
 * would have been right, and the fix.
 *
 * It is pure and it is browser-safe, which is the point: the renderer runs
 * exactly these checks beside the inputs and the engine runs them again before
 * it writes, so there is one answer to "what does this field accept" rather
 * than two that drift. Nothing here coerces. A value is the type the field
 * declares or it is refused — an admin that quietly reads `"false"` as false,
 * or an empty box as null, is an admin that writes something nobody typed.
 *
 * Every path resolves to a field key, so a caller can put the message under the
 * input it belongs to.
 */
export function checkRecordValues(
  resource: Resource,
  mode: WriteMode,
  values: RecordValues,
): ValidationError[] {
  const submitted = Object.keys(values);
  const accepted = acceptedKeys(resource, mode);

  if (submitted.length === 0) {
    return [
      {
        path: VALUES_PATH,
        message: "A write carries no values.",
        expected: `at least one of: ${formatList(accepted)}`,
        hint: `Put the values to write in \`${VALUES_PATH}\`, keyed by field: ${formatList(accepted)}.`,
      },
    ];
  }

  const fields = new Map(resource.fields.map((field) => [field.key, field]));
  const errors: ValidationError[] = [];

  for (const key of submitted) {
    const field = fields.get(key);
    const refusal = field
      ? refuseWriteTo(resource, field, mode)
      : unknownField(resource, key, accepted);

    if (refusal) {
      errors.push(refusal);
      continue;
    }

    // `field` is defined whenever there was no refusal: an unknown key is
    // always one.
    const problem = checkValue(field as Field, values[key] as JsonValue);
    if (problem) errors.push(problem);
  }

  if (mode === "create") {
    // Only a field this write could have carried is one it can be faulted for
    // leaving out: a `required` flag on a column nothing may write is a mistake
    // in the definition, and asking for a value that would then be refused is
    // no way to report it.
    for (const field of writableFields(resource, mode)) {
      if (field.required && !(field.key in values)) errors.push(missingValue(field));
    }
  }

  return errors;
}

/** Why a field may not be written, before the refusal is written down. */
interface Refusal {
  message: string;
  hint: string;
}

/**
 * Why this field may not be written, if it may not.
 *
 * Exported because the engine asks the same question again where the statement
 * is assembled, and two walls that disagree about the reason are worse than
 * one. It takes the mode because two of the answers depend on it: a primary key
 * the client issues is written when the record is made and never after, and
 * what a write "could have carried instead" is a different list on each.
 */
export function refuseWriteTo(
  resource: Resource,
  field: Field,
  mode: WriteMode,
): ValidationError | undefined {
  const refusal = refusalFor(resource, field, mode);
  if (!refusal) return undefined;

  return {
    path: `${VALUES_PATH}.${field.key}`,
    message: refusal.message,
    expected: `one of: ${formatList(acceptedKeys(resource, mode))}`,
    hint: refusal.hint,
  };
}

/**
 * The reason, without the list of what would have been accepted — which is
 * built out of this same predicate, so the two are kept apart rather than
 * calling each other in a circle.
 *
 * The order of the tests is deliberate: a field that is `editable` and also
 * sensitive cannot come from a definition that validates today, but it can come
 * from one stored before that rule existed — and when it does, the refusal
 * should name the reason that matters rather than the one that is merely true.
 */
function refusalFor(resource: Resource, field: Field, mode: WriteMode): Refusal | undefined {
  if (field.sensitive) {
    return {
      message: `Field \`${field.key}\` is sensitive and is never written from the admin.`,
      hint: `Remove \`${field.key}\` from the write. A secret is set by your application — expose an endpoint and call it with an \`httpCall\` action.`,
    };
  }

  if (field.key === resource.primaryKey) {
    const refusal = refusePrimaryKey(resource, field, mode);
    if (refusal) return refusal;
  }

  if (!isWritableType(field.type)) {
    return {
      message: `Field \`${field.key}\` has type \`${field.type}\` and cannot be written from the admin.`,
      hint: `Remove \`${field.key}\` from the write; a \`${field.type}\` value is edited through an endpoint in your application, called with an \`httpCall\` action.`,
    };
  }

  if (!field.editable) {
    return {
      message: `Field \`${field.key}\` is not editable.`,
      hint: `Remove \`${field.key}\` from the write, or mark it \`"editable": true\` in the definition of \`${resource.key}\` if an operator should be able to change it.`,
    };
  }

  return undefined;
}

/**
 * The primary key, which is the one column whose writability is a fact about
 * the table rather than about the field.
 *
 * Under `database` generation — the default, and what every resource meant
 * before generation could be declared — it is never written: the insert leaves
 * the column out and the database's own default fills it in. Under `client` it
 * is written exactly once, when the record is made, because that is when a key
 * is decided; an update that carried one would be changing the address of the
 * very form that sent it.
 */
function refusePrimaryKey(resource: Resource, field: Field, mode: WriteMode): Refusal | undefined {
  if (primaryKeyGenerationOf(resource) === "database") {
    return {
      message: `Field \`${field.key}\` is the primary key of \`${resource.key}\` and is issued by the database.`,
      hint: `Remove \`${field.key}\` from the write; the insert leaves the column out and reports back the key the database issued. If the key is genuinely chosen rather than generated, declare \`"primaryKeyGeneration": "client"\` on \`${resource.key}\` and mark \`${field.key}\` editable.`,
    };
  }

  if (mode === "update") {
    return {
      message: `Field \`${field.key}\` is the primary key of \`${resource.key}\`: it addresses the record and is set when it is made.`,
      hint: `Remove \`${field.key}\` from the write; a key the client issues is chosen once, at create, and moving it would move the address of the record being changed.`,
    };
  }

  return undefined;
}

/**
 * The fields a write in this mode may carry, in the order the resource declares
 * them. That order is the form's order: a form carries only the opt-in subset,
 * which is small by construction, and the author already put the fields in the
 * order they meant.
 */
function writableFields(resource: Resource, mode: WriteMode): Field[] {
  return resource.fields.filter((field) => refusalFor(resource, field, mode) === undefined);
}

function acceptedKeys(resource: Resource, mode: WriteMode): string[] {
  return writableFields(resource, mode).map((field) => field.key);
}

function unknownField(
  resource: Resource,
  key: string,
  accepted: readonly string[],
): ValidationError {
  return {
    path: `${VALUES_PATH}.${key}`,
    message: `Resource \`${resource.key}\` has no field \`${key}\`.`,
    expected: `one of: ${formatList(accepted)}`,
    hint: `Remove \`${key}\` from the write; \`${resource.key}\` accepts: ${formatList(accepted)}.`,
  };
}

function missingValue(field: Field): ValidationError {
  return {
    path: `${VALUES_PATH}.${field.key}`,
    message: `Required field \`${field.key}\` has no value.`,
    expected: describeType(field),
    hint: `Add \`${field.key}\` to the write; \`${field.label}\` is required and has no value to fall back on.`,
  };
}

/**
 * One value against the field it is written to. Null is a value here — the
 * field either admits it or is required, and both answers are this function's.
 */
function checkValue(field: Field, value: JsonValue): ValidationError | undefined {
  const path = `${VALUES_PATH}.${field.key}`;

  if (value === null) {
    if (!field.required) return undefined;
    return {
      path,
      message: `Required field \`${field.key}\` cannot be null.`,
      expected: describeType(field),
      hint: `Give \`${path}\` a value; \`${field.label}\` is required.`,
    };
  }

  // An untouched text box arrives as `""`, and writing that over a required
  // value is how a record loses its name without anyone deciding to.
  if (field.required && TEXT_TYPES.has(field.type) && value === "") {
    return {
      path,
      message: `Required field \`${field.key}\` cannot be empty.`,
      expected: describeType(field),
      hint: `Give \`${path}\` a value; \`${field.label}\` is required, and an empty box is not one.`,
    };
  }

  const problem = typeProblem(field, value);
  if (!problem) return undefined;

  return {
    path,
    message: `\`${describeValue(value)}\` is not ${describeType(field)}.`,
    expected: describeType(field),
    hint: `${problem} for \`${path}\`.`,
  };
}

/** What is wrong with the value for this field's type, as an imperative. */
function typeProblem(field: Field, value: JsonValue): string | undefined {
  switch (field.type) {
    case "text":
    case "longText":
      return typeof value === "string" ? undefined : "Send a string";

    case "email":
      if (typeof value !== "string") return "Send a string";
      if (value === "" || emailSchema.safeParse(value).success) return undefined;
      return "Send an email address such as `person@example.com`";

    case "url":
      if (typeof value !== "string") return "Send a string";
      if (value === "" || /^https?:\/\/\S+$/.test(value)) return undefined;
      return "Send an absolute URL such as `https://example.com/page`";

    case "number":
      // A `numeric` or `bigint` the reader could not answer as a number came
      // back as text, so it goes back the same way. The digits are bound
      // exactly as sent and the column does the converting: passing a string
      // through unread is the opposite of coercing it.
      if (typeof value === "number") {
        return Number.isFinite(value) ? undefined : "Send a finite number";
      }
      if (typeof value === "string" && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return undefined;
      return "Send a number, or the digits of one as a string";

    case "boolean":
      return typeof value === "boolean" ? undefined : "Send `true` or `false`";

    case "date":
      if (typeof value === "string" && isCalendarDate(value)) return undefined;
      return "Send a date as `YYYY-MM-DD`";

    case "dateTime":
      if (typeof value === "string" && isTimestamp(value)) return undefined;
      return "Send a timestamp as `YYYY-MM-DDTHH:MM:SS`, with `Z` or an offset when the column keeps one";

    case "enum":
      if (typeof value === "string" && field.values.includes(value)) return undefined;
      return `Send one of: ${formatList(field.values)}`;

    case "relation":
      if (typeof value === "number") return undefined;
      if (typeof value === "string" && value !== "") return undefined;
      return "Send the key of the record to point at, or `null` to point at nothing";

    default:
      // `json`, refused before this is reached; the arm keeps the switch total.
      return "Remove this field from the write";
  }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/** A date that is on the calendar, so `2026-02-30` is refused here and not by pg. */
function isCalendarDate(value: string): boolean {
  const parts = DATE_PATTERN.exec(value);
  return parts ? isRealDay(parts[1], parts[2], parts[3]) : false;
}

function isTimestamp(value: string): boolean {
  const parts = TIMESTAMP_PATTERN.exec(value);
  if (!parts || !isRealDay(parts[1], parts[2], parts[3])) return false;
  return Number(parts[4]) <= 23 && Number(parts[5]) <= 59 && Number(parts[6] ?? "0") <= 59;
}

function isRealDay(year?: string, month?: string, day?: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function describeType(field: Field): string {
  switch (field.type) {
    case "enum":
      return `one of: ${formatList(field.values)}`;
    case "relation":
      return `the key of a \`${field.target}\` record`;
    case "boolean":
      return "`true` or `false`";
    case "date":
      return "a date as `YYYY-MM-DD`";
    case "dateTime":
      return "a timestamp in ISO 8601";
    case "number":
      return "a number";
    default:
      return `a ${field.type} value`;
  }
}

function describeValue(value: JsonValue): string {
  if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  if (value === null || typeof value !== "object") return String(value);
  return Array.isArray(value) ? "array" : "object";
}
