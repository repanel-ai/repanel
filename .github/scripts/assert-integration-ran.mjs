/**
 * Fails CI when a test did not run.
 *
 * `apps/api`'s query-engine suites are gated on a database being named in the
 * environment, because what they assert cannot be asserted against a stub. A
 * gate has one failure mode: the environment stops supplying it, every one of
 * those tests turns into a skip, and the run goes green anyway. That is the gap
 * task 012 left open, and this is what closes it.
 *
 * Two assertions, for two different accidents:
 *   - nothing anywhere was skipped, which catches a *new* gated suite CI was
 *     never taught to feed;
 *   - each integration suite ran at least as many tests as it held when it was
 *     written down here, which catches one being emptied, renamed or deleted.
 *
 * Usage: node assert-integration-ran.mjs <path to jest --json report>
 */
import { readFile } from "node:fs/promises";

/**
 * The files whose presence in the report is the thing being proven, and what
 * each held when it was written down here. A floor rather than an equality:
 * suites grow, and growth is not a regression — only shrinkage is.
 */
const INTEGRATION_SUITES = [
  { file: "runtime.integration.spec.ts", floor: 30 },
  { file: "pooler.integration.spec.ts", floor: 9 },
  { file: "connector.integration.spec.ts", floor: 21 },
];

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("usage: node assert-integration-ran.mjs <jest-report.json>");
  process.exit(2);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const problems = [];

for (const { file, floor } of INTEGRATION_SUITES) {
  const suite = report.testResults.find((result) => result.name.endsWith(file));
  if (!suite) {
    problems.push(
      `${file} is not in the report at all. It was renamed, deleted, or jest never reached it.`,
    );
    continue;
  }

  const ran = suite.assertionResults.filter((test) => test.status === "passed").length;
  if (ran < floor) {
    problems.push(
      `${file} ran ${ran} tests; at least ${floor} were expected. ` +
        `If the suite legitimately shrank, lower its floor in INTEGRATION_SUITES and say why.`,
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
  `Nothing skipped, and ${INTEGRATION_SUITES.map(({ file }) => file).join(" and ")} ` +
    `ran against a real database (${report.numPassedTests} tests passed in total).`,
);
