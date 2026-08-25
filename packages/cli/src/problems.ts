import type { ValidationError } from "@repanel/contracts";
import { AssemblyError } from "./assemble/errors.js";
import { locate, type DefinitionSource } from "./assemble/sources.js";
import type { Style } from "./terminal.js";

/**
 * One problem with a definition, told where its author wrote it.
 *
 * Both commands that read a definition report the same thing the same way: the
 * file to open, the path inside it, and a fix. `validate` prints it to a
 * terminal and `dev` sends it to an overlay in the browser, and the two are the
 * same four lines because they are the same value.
 */
export interface Problem {
  /** The file, relative to the project root: `repanel/resources/users.json`. */
  readonly file: string;
  /** The path within that file, or `(root)` when the file itself is the subject. */
  readonly path: string;
  readonly message: string;
  /** What would have been valid. An assembly problem has no expectation to state. */
  readonly expected?: string;
  readonly hint: string;
}

/**
 * Validation's problems, each moved from the composed definition into the file
 * that supplied it. The hint is left exactly as the validator wrote it: it
 * names the path in the composed object, which is what a submission is judged
 * as, and the two paths are the same one in a single-file layout.
 */
export function problemsFrom(
  errors: readonly ValidationError[],
  sources: readonly DefinitionSource[],
): Problem[] {
  return errors.map((error) => {
    const location = locate(sources, error.path);
    return {
      file: location.file,
      path: location.path,
      message: error.message,
      expected: error.expected,
      hint: error.hint,
    };
  });
}

/** A definition that could not be composed at all: one problem, about a file. */
export function problemFromAssembly(error: AssemblyError): Problem {
  return { file: error.file, path: ROOT_OF_FILE, message: error.message, hint: error.hint };
}

/** An assembly problem is about the arrangement of a file, not a place inside one. */
const ROOT_OF_FILE = "";

/** The four lines a problem reads as. Blank `path` and `expected` are left out. */
export function formatProblem(problem: Problem): string[] {
  return [
    problem.path === "" ? problem.file : `${problem.file} · ${problem.path}`,
    `  ${problem.message}`,
    ...(problem.expected === undefined ? [] : [`  expected: ${problem.expected}`]),
    `  hint: ${problem.hint}`,
  ];
}

/**
 * Every problem where its author wrote it, then how many there were. Both
 * commands that report a definition's problems to a terminal — `validate` and
 * `deploy` — print exactly this, because a problem found by submitting is the
 * same problem found by checking, and reading two renderings of one thing is
 * how a developer learns to distrust both.
 */
export function reportProblems(problems: readonly Problem[]): string[] {
  const lines = problems.flatMap((problem) => [...formatProblem(problem), ""]);
  lines.push(`${count(problems.length, "problem")} found.`);
  return lines;
}

/** `1 resource`, `5 resources` — how a command counts what it read or refused. */
export function count(total: number, noun: string): string {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}

/**
 * The same problems, said by a command that is still running.
 *
 * `validate` and `deploy` print `reportProblems` and stop, so the count is the
 * last thing they say. `dev` is still serving the last definition that
 * validated, so the count is the *first* thing it says and what is still on
 * screen is said with it — then every problem underneath, indented to that
 * line's own text column, so a save that broke two files reads as one event
 * with two problems in it rather than as three separate messages.
 */
export function reportWhileServing(
  style: Style,
  problems: readonly Problem[],
  directory: string,
): string[] {
  return [
    `  ${style.bad}  ${count(problems.length, "problem")} in ${directory}/ — still serving the last definition that validated.`,
    ...problems.flatMap((problem) => formatProblem(problem).map((line) => `     ${line}`)),
  ];
}

/** A save that put it right, which is the whole of what there is to say. */
export function reportReloaded(style: Style, resources: number): string {
  return `  ${style.ok}  Definition reloaded — ${count(resources, "resource")}.`;
}
