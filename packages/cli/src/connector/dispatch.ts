import type { Definition, Descriptor, FrameAuditEvent, FrameError } from "@repanel/contracts";
import {
  DomainError,
  ValidationFailedError,
  indexResources,
  type ActionContext,
  type ActionRunner,
  type RecordReader,
  type RecordWriter,
} from "@repanel/engine";
import type { Pool } from "pg";

/** The engine, assembled once and used for every descriptor that arrives. */
export interface ConnectorEngine {
  reader: RecordReader;
  writer: RecordWriter;
  runner: ActionRunner;
}

/** What one descriptor came to: the DTO, or the refusal, and what it filed. */
export type Served =
  | { ok: true; result: unknown; audit: FrameAuditEvent[] }
  | { ok: false; error: FrameError; audit: FrameAuditEvent[] };

export interface ServeOptions {
  engine: ConnectorEngine;
  definition: Definition;
  /** The customer's database. Held here and nowhere else in this process. */
  pool: () => Promise<Pool>;
  /** The project's action signing secret, for an `httpCall` and nothing else. */
  secret: () => Promise<string>;
}

/**
 * One descriptor, served by the engine against the customer's database.
 *
 * This is where "descriptors, never SQL" is cashed in. What arrived names a
 * resource, a record, a relationship, an action — and the statement that
 * answers it is written *here*, by the same `QueryBuilder` Cloud would have
 * used, out of the same definition Cloud resolved the request against. Nothing
 * that crossed the wire is a statement, and nothing here could turn it into one
 * that the definition does not already describe.
 *
 * The switch is exhaustive by type: a descriptor kind added to the contract
 * without being handled here does not compile.
 */
export async function serve(options: ServeOptions, descriptor: Descriptor): Promise<Served> {
  const audit: FrameAuditEvent[] = [];
  const context: ActionContext = {
    resources: indexResources(options.definition),
    pool: options.pool,
    // The engine's own account of what it did, collected rather than filed:
    // the log lives in RePanel's database, so an event travels back with the
    // answer and is filed there before an operator is told anything.
    audit: (event) => {
      audit.push(event as FrameAuditEvent);
      return Promise.resolve();
    },
    secret: options.secret,
  };

  try {
    return { ok: true, result: await run(options.engine, context, descriptor), audit };
  } catch (failure) {
    return { ok: false, error: frameErrorOf(failure), audit };
  }
}

function run(
  { reader, writer, runner }: ConnectorEngine,
  context: ActionContext,
  descriptor: Descriptor,
): Promise<unknown> {
  switch (descriptor.kind) {
    case "listRecords":
      return reader.listRecords(context, descriptor.resourceKey, descriptor.query);
    case "getRecord":
      return reader.getRecord(context, descriptor.resourceKey, descriptor.id);
    case "listOptions":
      return reader.listOptions(context, descriptor.resourceKey, descriptor.query);
    case "listRelated":
      return reader.listRelated(
        context,
        descriptor.resourceKey,
        descriptor.id,
        descriptor.relationshipKey,
        descriptor.query,
      );
    case "createRecord":
      return writer.createRecord(context, descriptor.resourceKey, descriptor.write);
    case "updateRecord":
      return writer.updateRecord(context, descriptor.resourceKey, descriptor.id, descriptor.write);
    case "runAction":
      return runner.run(context, descriptor.resourceKey, descriptor.id, descriptor.actionKey);
    default: {
      const unreachable: never = descriptor;
      return Promise.reject(new Error(`unreachable descriptor ${JSON.stringify(unreachable)}`));
    }
  }
}

/**
 * A refusal, on its way back to the operator who caused it.
 *
 * A `DomainError` crosses as the code and the message it already carries —
 * those are what a caller was ever going to be told, and Cloud rebuilds the
 * error from them so the browser gets the same envelope on both rungs. A form's
 * details travel too: a value the resource cannot hold has to arrive as a path
 * the renderer can put the sentence under.
 *
 * Anything else is answered as an internal failure with nothing of its own in
 * it. What went wrong inside a connector is the customer's business, said at
 * the terminal it is running in, and it is not something to forward through
 * RePanel into somebody's browser.
 */
export function frameErrorOf(failure: unknown): FrameError {
  if (failure instanceof ValidationFailedError) {
    return { code: failure.code, message: failure.message, details: [...failure.details] };
  }
  if (failure instanceof DomainError) return { code: failure.code, message: failure.message };

  return { code: "internal_error", message: "The connector could not serve this request." };
}
