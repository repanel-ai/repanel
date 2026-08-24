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

/**
 * Where one of RePanel's own surfaces answers. Every deployment has three of
 * them on three origins, and each is read here rather than written anywhere
 * else: a link, an allowed origin and a setup snippet that disagree about where
 * something lives are three different bugs with one cause.
 *
 * A trailing slash is dropped once, here, because links are built onto these by
 * concatenation and no caller should have to remember that.
 */
const surfaceUrl = (fallback: string) =>
  z
    .url()
    .default(fallback)
    .transform((url) => url.replace(/\/+$/, ""));

/** Every environment variable the API reads, and what a valid value looks like. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  /**
   * Where this API answers from outside the browser — the origin an agent's MCP
   * client dials. It is the deployment's own address, stated so that whatever
   * has to print it prints the same one.
   */
  API_URL: surfaceUrl("http://localhost:3001"),
  /**
   * Where the console is served from. The MCP tools hand it to an authoring
   * agent as a deep link, so a human can go and paste the one thing an agent
   * must never handle — the customer's connection string.
   */
  CONSOLE_URL: surfaceUrl("http://localhost:5173"),
  /**
   * Where the rendered admin is served. A second origin by design (#025), which
   * is why it has to be named: it is one of the two browsers this API answers.
   */
  RUNTIME_URL: surfaceUrl("http://localhost:5174"),
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
