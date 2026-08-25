/**
 * Fails CI when a test did not run.
 *
 * `apps/api`'s query-engine suite is gated on `TEST_CUSTOMER_DATABASE_URL`,
 * because what it asserts cannot be asserted against a stub. A gate has one
 * failure mode: the environment stops supplying it, every one of those tests
 * turns into a skip, and the run goes green anyway. That is the gap task 012
 * left open, and this is what closes it.
 *
 * Two assertions, for two different accidents:
 *   - nothing anywhere was skipped, which catches a *new* gated suite CI was
 *     never taught to feed;
 *   - the integration suite ran at least as many tests as it held when this was
 *     written, which catches that suite being emptied, renamed or deleted.
 *
 * Usage: node assert-integration-ran.mjs <path to jest --json report>
 */
import { readFile } from "node:fs/promises";

/** The file whose presence in the report is the thing being proven. */
const INTEGRATION_SUITE = "runtime.integration.spec.ts";

/**
 * What that suite held when this check was written. A floor rather than an
 * equality: suites grow, and growth is not a regression — only shrinkage is.
 */
const INTEGRATION_FLOOR = 30;

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("usage: node assert-integration-ran.mjs <jest-report.json>");
  process.exit(2);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const problems = [];

const suite = report.testResults.find((result) => result.name.endsWith(INTEGRATION_SUITE));
if (!suite) {
  problems.push(
    `${INTEGRATION_SUITE} is not in the report at all. It was renamed, deleted, ` +
      `or jest never reached it.`,
  );
} else {
  const ran = suite.assertionResults.filter((test) => test.status === "passed").length;
  if (ran < INTEGRATION_FLOOR) {
    problems.push(
      `${INTEGRATION_SUITE} ran ${ran} tests; at least ${INTEGRATION_FLOOR} were expected. ` +
        `If the suite legitimately shrank, lower INTEGRATION_FLOOR in this file and say why.`,
    );
  }
}

const skipped = report.testResults
  .flatMap((result) => result.assertionResults)
  .filter((test) => test.status === "pending" || test.status === "todo");

if (skipped.length > 0) {
  const named = skipped.slice(0, 10).map((test) => `    ${test.fullName}`);
  const rest = skipped.length > named.length ? [`    …and ${skipped.length - named.length} more`] : [];
  problems.push(
    [
      `${skipped.length} test(s) did not run:`,
      ...named,
      ...rest,
      `  A skipped test passes without proving anything. Give CI whatever the`,
      `  suite is gated on, or delete the gate.`,
    ].join("\n"),
  );
}

if (problems.length > 0) {
  console.error("Tests that were supposed to run did not:\n");
  for (const problem of problems) console.error(`  ${problem}\n`);
  process.exit(1);
}

console.log(
  `Nothing skipped, and ${INTEGRATION_SUITE} ran against a real database ` +
    `(${report.numPassedTests} tests passed in total).`,
);
