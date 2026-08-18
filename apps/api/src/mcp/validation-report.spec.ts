import type { ValidationError } from "@repanel/contracts";
import { renderValidationReport } from "./validation-report";

const SENSITIVE_COLUMN: ValidationError = {
  path: "resources[0].views.table.columns[2]",
  message: "Sensitive field `password_hash` cannot be a table column.",
  expected: "a field that is not marked `sensitive`",
  hint: "Remove `password_hash` from `resources[0].views.table.columns`.",
};

const MISSING_NAVIGATION: ValidationError = {
  path: "navigation",
  message: "Required key `navigation` is missing.",
  expected: "an array of navigation groups",
  hint: 'Add `navigation: [{ label: "Data", resources: ["orders"] }]`.',
};

/** As many problems as a badly wrong definition really produces. */
const MANY: ValidationError[] = Array.from({ length: 40 }, (_unused, index) => ({
  path: `navigation[${index}].resources[0]`,
  message: `Navigation references unknown resource \`missing_${index}\`.`,
  expected: "a key of a resource defined in `resources`",
  hint: `Change \`navigation[${index}].resources[0]\` to one of: orders, users.`,
}));

describe("renderValidationReport", () => {
  it("writes out each problem with its location, expectation and fix", () => {
    const report = renderValidationReport([SENSITIVE_COLUMN]);

    expect(report).toContain("1. resources[0].views.table.columns[2]");
    expect(report).toContain(`problem:  ${SENSITIVE_COLUMN.message}`);
    expect(report).toContain(`expected: ${SENSITIVE_COLUMN.expected}`);
    expect(report).toContain(`hint:     ${SENSITIVE_COLUMN.hint}`);
  });

  it("says what to do with the report", () => {
    expect(renderValidationReport([SENSITIVE_COLUMN])).toContain(
      "call submit_definition again with the complete definition",
    );
  });

  it("counts the problems it is about to list", () => {
    expect(renderValidationReport([SENSITIVE_COLUMN, MISSING_NAVIGATION])).toContain(
      "2 problems, all listed below",
    );
    expect(renderValidationReport([SENSITIVE_COLUMN])).toContain("1 problem, listed below");
  });

  it("prints every problem, however many there are", () => {
    const report = renderValidationReport(MANY);

    for (const [index, error] of MANY.entries()) {
      expect(report).toContain(`${index + 1}. ${error.path}`);
      expect(report).toContain(error.hint);
    }
    expect(report).toContain("40 problems");
  });

  it("never trails off", () => {
    const report = renderValidationReport(MANY);

    // A truncated list costs the agent a round trip per hidden problem.
    expect(report).not.toContain("...");
    expect(report).not.toContain("…");
    expect(report).not.toMatch(/\bmore\b/);
  });

  it("passes a hint through exactly as validation wrote it", () => {
    // DECISIONS #015: hints suggest only safe fixes, so nothing here rewrites them.
    expect(renderValidationReport([MISSING_NAVIGATION])).toContain(MISSING_NAVIGATION.hint);
  });
});
