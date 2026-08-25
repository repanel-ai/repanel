import { SCHEMA_VERSION, validateDefinition } from "@repanel/contracts";
import { assembleDefinition, DEFINITION_DIRECTORY } from "../assemble/assemble.js";
import { AssemblyError } from "../assemble/errors.js";
import type { CommandResult } from "../command-result.js";
import { count, formatProblem, problemsFrom, type Problem } from "../problems.js";

/**
 * Assembles the definition and checks it, printing nothing a submission would
 * not have said. Everything here happens on the developer's machine: no
 * account, no network, no project.
 */
export async function validate(projectRoot: string): Promise<CommandResult> {
  let assembled;
  try {
    assembled = await assembleDefinition(projectRoot);
  } catch (error) {
    if (!(error instanceof AssemblyError)) throw error;
    return { exitCode: 1, lines: [error.message, `  hint: ${error.hint}`] };
  }

  const result = validateDefinition(assembled.definition);
  if (!result.valid) {
    return { exitCode: 1, lines: report(problemsFrom(result.errors, assembled.sources)) };
  }

  const { app, resources } = result.definition;
  return {
    exitCode: 0,
    lines: [
      `${app.name} — ${count(resources.length, "resource")} from ${DEFINITION_DIRECTORY}/, valid against definition schema ${SCHEMA_VERSION}.`,
    ],
  };
}

/** Each problem where its author wrote it, then how many there were. */
function report(problems: readonly Problem[]): string[] {
  const lines = problems.flatMap((problem) => [...formatProblem(problem), ""]);
  lines.push(`${count(problems.length, "problem")} found.`);
  return lines;
}
