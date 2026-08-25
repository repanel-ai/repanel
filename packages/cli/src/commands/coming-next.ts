import type { CommandResult } from "../command-result.js";
import { COMMANDS } from "../usage.js";

/** The commands task 020 fills in. */
export type PendingCommand = Exclude<keyof typeof COMMANDS, "validate" | "dev">;

/**
 * Says what a command will do, and that it does not do it yet. Exits nonzero
 * on purpose: a command that has not run is a command that has not succeeded,
 * whatever it printed.
 */
export function comingNext(command: PendingCommand): CommandResult {
  return {
    exitCode: 1,
    lines: [
      `\`repanel ${command}\` is not implemented yet. ${COMMANDS[command].details[0]}`,
      "Today the CLI can `repanel validate` and `repanel dev`.",
    ],
  };
}
