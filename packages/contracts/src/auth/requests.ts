import { z } from "zod";

/**
 * Bcrypt hashes at most 72 bytes and silently ignores the rest, which would
 * let two different long passwords open the same account. Refuse instead.
 */
const PASSWORD_MAX = 72;

/**
 * Normalized before it is validated: the address is the account's identity, so
 * `Ada@Example.com ` and `ada@example.com` must not become two users.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: "must be a valid email address" })
      .max(254, "must be at most 254 characters"),
  );

const passwordField = z
  .string()
  .min(8, "must be at least 8 characters")
  .max(PASSWORD_MAX, `must be at most ${PASSWORD_MAX} characters`);

const nameField = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .max(100, "must be at most 100 characters");

/** What `POST /auth/signup` accepts. */
export const signupRequestSchema = z.object({
  email: emailField,
  password: passwordField,
  name: nameField,
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;

/** What `POST /auth/login` accepts. */
export const loginRequestSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
