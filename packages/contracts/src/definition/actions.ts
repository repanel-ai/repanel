import { z } from "zod";
import { identifierSchema } from "./identifier.js";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const actionBase = {
  key: identifierSchema,
  label: z.string().min(1),
  /** Shown before the action runs. Required: every action is a write. */
  confirm: z.string().min(1),
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
