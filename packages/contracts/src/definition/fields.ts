import { z } from "zod";
import { identifierSchema } from "./identifier.js";

/** Field types that free-text search may target. */
export const TEXT_FIELD_TYPES = ["text", "longText", "email", "url"] as const;

/**
 * How grave one value of an enum is. The vocabulary is fixed and small on
 * purpose: an admin that renders every customer's states has to draw a bounded
 * set of severities, and a free-form one would be a styling hook (DECISIONS #029).
 */
export const TONES = ["positive", "neutral", "attention", "critical"] as const;

export const toneSchema = z.enum(TONES);

export type Tone = z.infer<typeof toneSchema>;

const fieldBase = {
  key: identifierSchema,
  label: z.string().min(1),
  /** Never leaves the API unmasked; cannot appear in a table column. */
  sensitive: z.boolean().default(false),
  /** Part of the resource, but never displayed. */
  hidden: z.boolean().default(false),
  /**
   * The column may be written from the admin. False unless the author says
   * otherwise, and the resource has to declare the write as well: writability
   * is stated twice on purpose, because nothing about a database column says
   * whether a human should be typing into it (DECISIONS #055).
   */
  editable: z.boolean().default(false),
  /**
   * The field must carry a value. On create it has to be supplied and cannot be
   * null; on update it may be left out — which changes nothing — but may never
   * be set to null. Only meaningful on an `editable` field.
   */
  required: z.boolean().default(false),
};

const scalarField = <T extends string>(type: T) =>
  z.strictObject({ ...fieldBase, type: z.literal(type) });

export const fieldSchema = z.discriminatedUnion("type", [
  scalarField("text"),
  scalarField("longText"),
  scalarField("number"),
  scalarField("boolean"),
  scalarField("date"),
  scalarField("dateTime"),
  scalarField("email"),
  scalarField("url"),
  scalarField("json"),
  z.strictObject({
    ...fieldBase,
    type: z.literal("enum"),
    values: z.array(z.string().min(1)).min(1),
    /**
     * Which of this field's values are grave and which are routine. The runtime
     * has never seen the customer's vocabulary, so severity is said here or not
     * at all — `suspended` is routine in one product and an alarm in the next.
     * A value the map leaves out renders quiet, which is what every value gets
     * until the map exists.
     */
    tones: z.record(z.string().min(1), toneSchema).default({}),
  }),
  z.strictObject({
    ...fieldBase,
    type: z.literal("relation"),
    /** Key of the resource this field points at. */
    target: identifierSchema,
  }),
]);

export type Field = z.infer<typeof fieldSchema>;
export type FieldType = Field["type"];

/**
 * The types a form may write. Every type but `json`: a blob has no single
 * input that fits it, and the shape inside it is the application's rather than
 * the admin's — editing one belongs in an endpoint (DECISIONS #010).
 */
export const WRITABLE_FIELD_TYPES = [
  "text",
  "longText",
  "number",
  "boolean",
  "date",
  "dateTime",
  "email",
  "url",
  "enum",
  "relation",
] as const satisfies readonly FieldType[];

export function isWritableType(type: FieldType): boolean {
  const writable: readonly string[] = WRITABLE_FIELD_TYPES;
  return writable.includes(type);
}

export function isTextField(field: Field): boolean {
  const textTypes: readonly string[] = TEXT_FIELD_TYPES;
  return textTypes.includes(field.type);
}
