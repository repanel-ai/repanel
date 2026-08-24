import { z } from "zod";
import { identifierSchema } from "./identifier.js";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Whether an action is offered at all, decided from one of the record's own
 * values. One condition, never two, and never an expression: this is the first
 * rung of DECISIONS #010's precondition ladder, and the rung above it — "this
 * and that", "this or that" — is a rule, and a rule lives in the endpoint the
 * action calls.
 *
 * `equals` and `isSet` are stated one at a time; the schema admits both keys so
 * that saying neither or saying both is answered by the referential pass, in
 * this package's own words, rather than by a union failure that can only say
 * the object matched nothing.
 */
export const visibleWhenSchema = z.strictObject({
  /** A field of the same resource. Never a `sensitive` one. */
  field: identifierSchema,
  /** The value the field must hold. */
  equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** That the field holds anything at all. */
  isSet: z.literal(true).optional(),
});

export type VisibleWhen = z.infer<typeof visibleWhenSchema>;

const actionBase = {
  key: identifierSchema,
  label: z.string().min(1),
  /** Shown before the action runs. Required: every action is a write. */
  confirm: z.string().min(1),
  /**
   * When the action is worth offering. Left out, it always is — which is what
   * every action written before this key existed already meant.
   */
  visibleWhen: visibleWhenSchema.optional(),
};

export const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...actionBase,
    kind: z.literal("dbUpdate"),
    field: identifierSchema,
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
  z.strictObject({
    ...actionBase,
    kind: z.literal("httpCall"),
    method: z.enum(HTTP_METHODS),
    /** Absolute URL; `{field_key}` placeholders are filled from the record. */
    url: z
      .string()
      .regex(
        /^https?:\/\/\S+$/,
        "an absolute http(s) URL, for example https://api.example.com/users/{id}/approve",
      ),
  }),
]);

export type Action = z.infer<typeof actionSchema>;
export type ActionKind = Action["kind"];
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** One arm of the union each, named so a caller can say which it is holding. */
export type DbUpdateAction = Extract<Action, { kind: "dbUpdate" }>;
export type HttpCallAction = Extract<Action, { kind: "httpCall" }>;

/** What a `dbUpdate` writes: one literal, never an expression. */
export type ActionValue = DbUpdateAction["value"];
