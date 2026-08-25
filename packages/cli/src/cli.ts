import { parseArgs } from "node:util";
import { comingNext } from "./commands/coming-next.js";
import { validate } from "./commands/validate.js";
import type { CommandResult } from "./command-result.js";
import { commandHelp, isCommand, usage } from "./usage.js";

/**
 * Argument parsing and dispatch, and nothing else: one command per call, each
 * returning what to print. Node's own parser does the parsing, so an unknown
 * option is refused here rather than ignored by every command in turn.
 *
 * @param argv the arguments after the program name.
 * @param projectRoot the directory a command reads the definition from.
 */
export async function run(
  argv: readonly string[],
  projectRoot: string,
): Promise<CommandResult> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: { help: { type: "boolean", short: "h" } },
      allowPositionals: true,
    });
  } catch (error) {
    return usageError((error as Error).message);
  }

  const [name, ...rest] = parsed.positionals;
  if (name === undefined) return { exitCode: 0, lines: usage() };
  if (!isCommand(name)) return usageError(`Unknown command \`${name}\`.`);
  if (parsed.values.help) return { exitCode: 0, lines: commandHelp(name) };
  if (rest.length > 0) return usageError(`\`repanel ${name}\` takes no arguments.`);

  return name === "validate" ? validate(projectRoot) : comingNext(name);
}

/** Exit 2 for "you asked for something that is not a command": the shell convention. */
function usageError(message: string): CommandResult {
  return { exitCode: 2, lines: [message, "", ...usage()] };
}
