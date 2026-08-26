import { randomInt } from "node:crypto";

/** Base62: a password has to survive a copy-paste and a chat window unharmed. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * 20 base62 characters is ~119 bits — never guessed, only shared. It is also
 * well inside the 72 bytes bcrypt reads, so every character of it counts.
 */
const LENGTH = 20;

/**
 * The password an operator is created with. It is generated rather than chosen
 * because the owner types it into no field: RePanel shows it once, the owner
 * passes it on, and only its bcrypt hash is ever stored. Losing it means
 * revoking the person and adding them again — there is no reset in v1, and
 * pretending otherwise would be a screen that cannot keep its promise.
 */
export function createOperatorPassword(): string {
  let password = "";
  for (let drawn = 0; drawn < LENGTH; drawn += 1) {
    password += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return password;
}
