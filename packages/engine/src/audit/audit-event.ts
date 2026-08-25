import type { AuditKind, AuditOutcome, AuditValues, RecordId } from "@repanel/contracts";
import type { ReadContext } from "../read/record-reader.js";

/**
 * What the engine says it did, at the moment it did it.
 *
 * It is what happened and nothing about who it happened for: there is no actor
 * here, no project and no clock. This package is given a definition, a way to
 * reach a database and a secret to sign with, and it looks nothing up for
 * itself — so the half of an audit record that identifies the operator belongs
 * to the host, which is the only thing that ever knew it.
 */
export interface AuditEvent {
  kind: AuditKind;
  /** The resource the record belongs to, by the key the definition gave it. */
  resourceKey: string;
  /** The record it was about. Null for a create that never got as far as a key. */
  recordId: RecordId | null;
  /** The action's key, for an `action`; null for a form write. */
  actionKey: string | null;
  outcome: AuditOutcome;
  /** Which refusal or which failure; null when the outcome is `ok`. */
  reason: string | null;
  before: AuditValues | null;
  after: AuditValues | null;
}

/**
 * Where an event goes. A function rather than an interface, because there is
 * one thing to do with an event and a host that had to implement a class to say
 * so would be implementing a class to say one thing.
 */
export type AuditWriter = (event: AuditEvent) => Promise<void>;

/**
 * What writing takes: everything reading takes, plus somewhere to account for
 * it. The writer sits in the context beside the pool rather than in a
 * constructor, for the same reason the pool does — which operator is writing,
 * and to which project, are facts about the request and not about the engine.
 */
export interface WriteContext extends ReadContext {
  audit: AuditWriter;
}
