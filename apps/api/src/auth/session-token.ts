import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/** A fresh 256-bit session token; only its owner's browser ever sees this value. */
export function createSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Sessions are stored and found by digest, so a leaked `sessions` table cannot
 * be replayed as cookies. sha256 is the right choice here: the input is already
 * high-entropy, so a slow hash would buy nothing.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
