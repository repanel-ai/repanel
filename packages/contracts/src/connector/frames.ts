import { z } from "zod";
import { AUDIT_KINDS, AUDIT_OUTCOMES } from "../runtime/activity.js";
import { identifierSchema } from "../definition/identifier.js";
import { listRecordsQuerySchema, optionsQuerySchema } from "../runtime/requests.js";
import { recordIdSchema } from "../runtime/records.js";
import { recordWriteSchema } from "../runtime/writes.js";

/**
 * What Cloud and a connector say to each other, and the whole of it.
 *
 * The law this file exists to keep is one sentence: **Cloud sends
 * definition-derived descriptors, never SQL**. It is kept structurally rather
 * than by review. A descriptor is a closed discriminated union whose members
 * are the runtime request schemas this package already defines — the same
 * `listRecordsQuerySchema` a browser's query string is parsed with, the same
 * `recordWriteSchema` a form body is — plus keys that must match
 * `identifierSchema`. There is no member that carries free text for the far
 * side to run, and adding one would be a change to this union: a type error at
 * every call site, and a failing spec, rather than a request somebody has to
 * notice and reject.
 *
 * A new capability therefore extends the shared contract first. That is the
 * addendum's law — there is no connector-only query path, ever — and this is
 * the file it is enforced in (DECISIONS #064).
 *
 * The rule is asymmetric on purpose. A descriptor travels Cloud → connector and
 * is closed. A result travels connector → Cloud carrying the customer's own
 * rows, which are free text by nature and could never be constrained by a
 * schema. Nothing about a result can make RePanel ask the customer's database
 * for something the definition does not describe, which is what the law is for.
 */

/** The seven things RePanel can ask of a customer's database, and no eighth. */
export const DESCRIPTOR_KINDS = [
  "listRecords",
  "getRecord",
  "listOptions",
  "listRelated",
  "createRecord",
  "updateRecord",
  "runAction",
] as const;

export type DescriptorKind = (typeof DESCRIPTOR_KINDS)[number];

/**
 * One request against the admin a definition describes, addressed exactly as
 * the engine's own entry points address it: by resource key, record id,
 * relationship key and action key, with a query or a write that is already this
 * package's own.
 */
export const descriptorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("listRecords"),
    resourceKey: identifierSchema,
    query: listRecordsQuerySchema,
  }),
  z.strictObject({
    kind: z.literal("getRecord"),
    resourceKey: identifierSchema,
    id: recordIdSchema,
  }),
  z.strictObject({
    kind: z.literal("listOptions"),
    resourceKey: identifierSchema,
    query: optionsQuerySchema,
  }),
  z.strictObject({
    kind: z.literal("listRelated"),
    resourceKey: identifierSchema,
    id: recordIdSchema,
    relationshipKey: identifierSchema,
    query: listRecordsQuerySchema,
  }),
  z.strictObject({
    kind: z.literal("createRecord"),
    resourceKey: identifierSchema,
    write: recordWriteSchema,
  }),
  z.strictObject({
    kind: z.literal("updateRecord"),
    resourceKey: identifierSchema,
    id: recordIdSchema,
    write: recordWriteSchema,
  }),
  z.strictObject({
    kind: z.literal("runAction"),
    resourceKey: identifierSchema,
    id: recordIdSchema,
    actionKey: identifierSchema,
  }),
]);

export type Descriptor = z.infer<typeof descriptorSchema>;

/**
 * What a connector asks Cloud for. Two questions, both about the admin it is
 * serving rather than about any record: the session it is opening, and the
 * definition it draws from.
 */
export const questionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("openSession") }),
  z.strictObject({ kind: z.literal("pullDefinition") }),
]);

export type Question = z.infer<typeof questionSchema>;

/**
 * The definition a connector serves, as it crosses. The payload is unchecked
 * here and validated on arrival with `validateDefinition` — the same call Cloud
 * makes before serving a request out of it, so both ends refuse the same
 * definitions for the same reasons.
 */
const publishedSchema = z.strictObject({
  version: z.number().int().positive(),
  payload: z.unknown(),
});

/** What Cloud answers a question with. */
export const answerSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("session"),
    /**
     * The project's action signing secret. It reaches the connector because the
     * connector is where an `httpCall` action is sent from — the customer's own
     * endpoints may not be reachable from anywhere else — and it is the
     * customer's own secret, held in memory by the customer's own process for
     * as long as the session lasts (DECISIONS #064).
     */
    actionSecret: z.string().min(1),
    /** Null while the project has published nothing: there is nothing to serve yet. */
    definition: publishedSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal("definition"),
    definition: publishedSchema.nullable(),
  }),
]);

export type Answer = z.infer<typeof answerSchema>;

/** What Cloud tells a connector without being asked. */
export const notificationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("definitionPublished"), version: z.number().int().positive() }),
]);

export type Notification = z.infer<typeof notificationSchema>;

/**
 * A failure, in the shape every other RePanel surface already answers one in
 * (`ErrorEnvelope`). The details are here because a form's refusals are: a
 * value the resource cannot hold comes back as a path the renderer puts the
 * sentence under, and a hop that dropped them would turn a repairable form into
 * an opaque one.
 */
export const frameErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string(),
  details: z
    .array(
      z.strictObject({
        path: z.string(),
        message: z.string(),
        expected: z.string(),
        hint: z.string(),
      }),
    )
    .optional(),
});

export type FrameError = z.infer<typeof frameErrorSchema>;

/**
 * What the engine says it did, on its way back to the control plane that files
 * it. Structurally the engine's own `AuditEvent`: the connector runs the engine,
 * so what task 028 captures is produced by the same code in both modes and the
 * only difference is that it travels before it is filed.
 */
export const auditEventSchema = z.strictObject({
  kind: z.enum(AUDIT_KINDS),
  resourceKey: identifierSchema,
  recordId: recordIdSchema.nullable(),
  actionKey: identifierSchema.nullable(),
  outcome: z.enum(AUDIT_OUTCOMES),
  reason: z.string().nullable(),
  before: z.record(identifierSchema, z.json()).nullable(),
  after: z.record(identifierSchema, z.json()).nullable(),
});

export type FrameAuditEvent = z.infer<typeof auditEventSchema>;

/** Every frame Cloud sends. Closed, and discriminated on `frame`. */
export const CLOUD_FRAMES = ["execute", "answer", "notify", "heartbeat"] as const;

export const cloudFrameSchema = z.discriminatedUnion("frame", [
  z.strictObject({
    frame: z.literal("execute"),
    id: z.number().int().positive(),
    /**
     * The published version this request was resolved against. A connector
     * holding an older one pulls before it answers, so a publish reaches a live
     * connector without an operator seeing a blip; a connector holding a newer
     * one refuses, because the two disagree about what is live.
     */
    definitionVersion: z.number().int().positive(),
    descriptor: descriptorSchema,
  }),
  z.strictObject({
    frame: z.literal("answer"),
    id: z.number().int().positive(),
    outcome: z.discriminatedUnion("ok", [
      z.strictObject({ ok: z.literal(true), answer: answerSchema }),
      z.strictObject({ ok: z.literal(false), error: frameErrorSchema }),
    ]),
  }),
  z.strictObject({ frame: z.literal("notify"), notification: notificationSchema }),
  z.strictObject({ frame: z.literal("heartbeat") }),
]);

export type CloudFrame = z.infer<typeof cloudFrameSchema>;

/** Every frame a connector sends. Closed, and discriminated on `frame`. */
export const CONNECTOR_FRAMES = ["ask", "result", "heartbeat"] as const;

const auditTrail = z.array(auditEventSchema).default([]);

export const connectorFrameSchema = z.discriminatedUnion("frame", [
  z.strictObject({
    frame: z.literal("ask"),
    id: z.number().int().positive(),
    question: questionSchema,
  }),
  z.strictObject({
    frame: z.literal("result"),
    id: z.number().int().positive(),
    outcome: z.discriminatedUnion("ok", [
      z.strictObject({
        ok: z.literal(true),
        /**
         * The DTO the engine produced: a page of records, one record, a list of
         * options, an action's acknowledgement. It is the customer's own data
         * and is carried rather than parsed — see the asymmetry at the top of
         * this file.
         */
        result: z.unknown(),
      }),
      z.strictObject({ ok: z.literal(false), error: frameErrorSchema }),
    ]),
    /** A refused write is still a write that was attempted, and is still filed. */
    audit: auditTrail,
  }),
  z.strictObject({
    frame: z.literal("heartbeat"),
    /** What this connector is serving, so a stale one is visible without a request. */
    definitionVersion: z.number().int().nonnegative(),
  }),
]);

export type ConnectorFrame = z.infer<typeof connectorFrameSchema>;

/**
 * How often a connector says it is there, and how long silence is tolerated.
 *
 * The heartbeat is a frame rather than a WebSocket ping because it is read by
 * more than the socket: the console's Connection page shows when a project was
 * last heard from, and that has to be a fact about the connector rather than
 * about a TCP connection an intermediary might be holding open for it. Cloud
 * answers each one, so the same silence is detectable from both ends — a
 * half-open socket is otherwise invisible to whichever side is only listening.
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Three missed in a row. Two is a hiccup; three is gone. */
export const HEARTBEAT_TIMEOUT_MS = 45_000;
