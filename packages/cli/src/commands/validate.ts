import { SCHEMA_VERSION, validateDefinition, type ValidationError } from "@repanel/contracts";
import { assembleDefinition, DEFINITION_DIRECTORY } from "../assemble/assemble.js";
import { AssemblyError } from "../assemble/errors.js";
import { locate, type DefinitionSource } from "../assemble/sources.js";
import type { CommandResult } from "../command-result.js";

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
    return { exitCode: 1, lines: report(result.errors, assembled.sources) };
  }

  const { app, resources } = result.definition;
  return {
    exitCode: 0,
    lines: [
      `${app.name} — ${count(resources.length, "resource")} from ${DEFINITION_DIRECTORY}/, valid against definition schema ${SCHEMA_VERSION}.`,
    ],
  };
}

/**
 * Each problem where its author wrote it: the file, then the path within that
 * file. The hint is printed as the validator wrote it, so it still names the
 * path in the composed definition — that is the object a submission is judged
 * as, and the two paths are the same one in a single-file layout.
 */
function report(
  errors: readonly ValidationError[],
  sources: readonly DefinitionSource[],
): string[] {
  const lines: string[] = [];
  for (const error of errors) {
    const location = locate(sources, error.path);
    lines.push(
      `${location.file} · ${location.path}`,
      `  ${error.message}`,
      `  expected: ${error.expected}`,
      `  hint: ${error.hint}`,
      "",
    );
  }
  lines.push(`${count(errors.length, "problem")} found.`);
  return lines;
}

function count(total: number, noun: string): string {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}
