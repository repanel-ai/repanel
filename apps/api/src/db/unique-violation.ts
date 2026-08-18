/** Postgres reports a breached unique constraint as SQLSTATE `23505`. */
const UNIQUE_VIOLATION = "23505";

/**
 * Whether a failed query was refused for duplicating a unique value. Drizzle
 * wraps the driver's error, so the code sits somewhere down the cause chain
 * rather than on what was thrown.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let cause: unknown = error; cause instanceof Error; cause = cause.cause) {
    if ((cause as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}
