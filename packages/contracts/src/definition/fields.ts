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

export function isTextField(field: Field): boolean {
  const textTypes: readonly string[] = TEXT_FIELD_TYPES;
  return textTypes.includes(field.type);
}
