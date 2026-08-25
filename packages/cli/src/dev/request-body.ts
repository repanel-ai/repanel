import type { IncomingMessage } from "node:http";

/** A request body that is not the JSON this server can read. */
export class UnreadableBodyError extends Error {}

/**
 * More than any form submits, and small enough that a body nobody meant to send
 * is refused before it is held in memory. The hosted API is behind its own
 * limits; this one is behind this.
 */
const MAX_BODY_BYTES = 1_048_576;

/**
 * The JSON a write carries. Read here rather than by a framework, because this
 * server has none — and refused rather than truncated, because a half-read
 * write is the one thing worse than a rejected one.
 */
export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new UnreadableBodyError("This request's body is larger than this server accepts.");
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") throw new UnreadableBodyError("This request needs a JSON body.");

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new UnreadableBodyError("This request's body is not valid JSON.");
  }
}
