import { z } from "zod";
import { identifierSchema } from "./identifier.js";

/** Field types that free-text search may target. */
export const TEXT_FIELD_TYPES = ["text", "longText", "email", "url"] as const;

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
