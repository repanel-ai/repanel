import { z } from "zod";

/** Every environment variable the API reads, and what a valid value looks like. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses the process environment at boot. Throws with every offending variable
 * named at once, so a misconfigured deploy is fixed in one pass.
 */
export function validateEnv(env: Record<string, unknown>): Env {
  const result = envSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment:\n${problems}`);
}
