import { ROOT_PATH } from "@repanel/contracts";
import { ValidationFailedError } from "../errors/domain-errors";

/**
 * The largest payload worth parsing. The reference definition is a few
 * kilobytes, so a megabyte is already far past anything real — a submission
 * this size is a mistake, and parsing it only makes the mistake expensive.
 */
export const MAX_PAYLOAD_BYTES = 1024 * 1024;

/**
 * Refuses a payload too large to be a definition, before anything parses it.
 * A refused submission is not stored: there is nothing here to read back.
 */
export function requirePayloadWithinLimit(payload: unknown): void {
  // `JSON.stringify` answers `undefined` for something that is not JSON at
  // all. Saying so is validation's job, not the size guard's, so let it pass.
  const serialized = JSON.stringify(payload) ?? "";
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes <= MAX_PAYLOAD_BYTES) return;

  throw new ValidationFailedError("Definition is too large", [
    {
      path: ROOT_PATH,
      message: `The definition is ${bytes} bytes, over the ${MAX_PAYLOAD_BYTES} byte limit.`,
      expected: `a definition of at most ${MAX_PAYLOAD_BYTES} bytes`,
      hint:
        "Submit the definition on its own — a payload this size usually carries " +
        "record data, which belongs in the customer's database rather than here.",
    },
  ]);
}
