/**
 * What the suite boots on.
 *
 * Crewbase validates its environment while its modules are being defined — a
 * misconfigured application should refuse to start, not start and fail later —
 * so these have to be in place before the first module is imported, which is
 * what jest's `setupFiles` is for rather than a `beforeAll`.
 */
export const TEST_ACTION_SECRET = "sk_test_9c2f41d8e6b74a0f8d3c5e7a1b9f0c24";

/** No test opens a connection: the pool is built, and nothing ever queries it. */
process.env.DATABASE_URL ??= "postgres://crewbase:crewbase@localhost:5433/crewbase";
process.env.REPANEL_ACTION_SECRET = TEST_ACTION_SECRET;
