import { z } from "zod";
import { identifierSchema } from "../definition/identifier.js";

/**
 * What a create or an update carries: field keys to the values to write, and
 * nothing else. Strict, and keyed by the identifier pattern, so a key that
 * could not name a field is refused before anything looks it up — the same
 * answer a query string gets for a parameter nobody recognizes.
 *
 * The values are plain JSON here and are checked against the resource's own
 * fields afterwards (`checkRecordValues`), because what a value must be is a
 * fact about the definition rather than about the wire.
 *
 * An update carries only what changes: a field left out keeps the value it has.
 */
export const recordWriteSchema = z.strictObject({
  values: z.record(identifierSchema, z.json()),
});

export type RecordWrite = z.infer<typeof recordWriteSchema>;
