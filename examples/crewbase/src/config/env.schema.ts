import { z } from "zod";

/** Every environment variable Crewbase reads, and what a valid value looks like. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.url(),
  /**
   * The RePanel project's action secret. Every request that reaches `/repanel/*`
   * is verified against it, so booting without one would leave the admin API
   * open — which is why it is required rather than defaulted.
   */
  REPANEL_ACTION_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses the process environment at boot, naming every offending variable at
 * once so a misconfigured deploy is fixed in one pass.
 */
export function validateEnv(env: Record<string, unknown>): Env {
  const result = envSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment:\n${problems}`);
}
