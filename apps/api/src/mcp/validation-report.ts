import type { ValidationError } from "@repanel/contracts";

/**
 * Renders a validation failure for the agent that has to fix it. Every error
 * is printed: an agent repairs in one pass, or in as many passes as we hid
 * problems from it (DECISIONS #008). Nothing here caps or summarizes the list.
 */
export function renderValidationReport(errors: readonly ValidationError[]): string {
  const problems = errors.map(renderProblem);
  return [header(errors.length), ...problems].join("\n\n");
}

function header(total: number): string {
  const counted = total === 1 ? "1 problem, listed below" : `${total} problems, all listed below`;
  return (
    `The definition is invalid. ${counted}.\n` +
    "Fix every one, then call submit_definition again with the complete definition."
  );
}

function renderProblem(error: ValidationError, index: number): string {
  return [
    `${index + 1}. ${error.path}`,
    `   problem:  ${error.message}`,
    `   expected: ${error.expected}`,
    `   hint:     ${error.hint}`,
  ].join("\n");
}
