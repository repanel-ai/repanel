import { z } from "zod";

/** AES-256 takes a 256-bit key, carried through the environment as base64. */
const KEY_BYTES = 32;

/** Whatever is wrong with a key, this is what a correct one looks like. */
const KEY_REQUIREMENT = `must be ${KEY_BYTES} random bytes, base64 encoded`;

/**
 * What the suite runs on. Nothing under test encrypts a value a later run has
 * to read back, so tests get a throwaway key rather than an environment to
 * configure — and thirty-two zero bytes can never be mistaken for a secret.
 * Every other mode is refused without a real one.
 */
const TEST_ONLY_KEY = Buffer.alloc(KEY_BYTES).toString("base64");

const appEncryptionKey = z
  .base64(KEY_REQUIREMENT)
  .refine((key) => Buffer.from(key, "base64").byteLength === KEY_BYTES, KEY_REQUIREMENT);

/** Every environment variable the API reads, and what a valid value looks like. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  /**
   * Encrypts customer DSNs at rest. It is the only thing standing between a
   * leaked `connections` table and every customer database, so it belongs
   * wherever this deployment keeps secrets — never beside the database URL.
   */
  APP_ENCRYPTION_KEY: appEncryptionKey,
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses the process environment at boot. Throws with every offending variable
 * named at once, so a misconfigured deploy is fixed in one pass.
 */
export function validateEnv(env: Record<string, unknown>): Env {
  const result = envSchema.safeParse(withTestKey(env));
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment:\n${problems}`);
}

/** The suite's one exemption, granted here so no feature has to know about it. */
function withTestKey(env: Record<string, unknown>): Record<string, unknown> {
  if (env.NODE_ENV !== "test" || env.APP_ENCRYPTION_KEY !== undefined) return env;
  return { ...env, APP_ENCRYPTION_KEY: TEST_ONLY_KEY };
}
