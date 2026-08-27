import { createHash, randomInt } from "node:crypto";

/** Base62: a token has to survive a shell command and a copy-paste unharmed. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** 40 base62 characters is ~238 bits — a token is never guessed, only stolen. */
const RANDOM_LENGTH = 40;

/**
 * Says what the string is the moment a human sees it in a log or a unit file,
 * and says it is not an agent token: those are `rpk_`, they reach the MCP
 * server, and the two are never interchangeable.
 */
const PREFIX = "rpc_";

/** What a well-formed token looks like. Anything else is refused unread. */
export const CONNECTOR_TOKEN_PATTERN = /^rpc_[0-9A-Za-z]{40}$/;

/** A fresh token. Only the connector it is handed to ever sees this value. */
export function createConnectorToken(): string {
  let random = "";
  for (let drawn = 0; drawn < RANDOM_LENGTH; drawn += 1) {
    random += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return `${PREFIX}${random}`;
}

/**
 * Tokens are stored and found by digest, so a leaked `connector_tokens` table
 * cannot be replayed. sha256 is the right choice here: the input is already
 * high-entropy, so a slow hash would buy nothing.
 */
export function hashConnectorToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
