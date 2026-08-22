import { randomBytes } from "node:crypto";

/** 256 bits, which is what HMAC-SHA256 has room for and no less than a key needs. */
const SECRET_BYTES = 32;

/**
 * A fresh signing key for one project. base64url because this value is read by
 * a human once and pasted into a config file, an environment variable or a
 * secret store, and every character in that alphabet survives all three.
 *
 * The string is the key: both sides feed these characters to HMAC, and neither
 * decodes them first. Saying so is the whole of the encoding question that
 * verifying implementations otherwise have to guess at (docs/SIGNING.md).
 */
export function createActionSecret(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}
