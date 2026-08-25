#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { run } from "./cli.js";

/**
 * Asks the operator a yes/no question, defaulting to yes on an empty line.
 * Absent when there is no terminal: a confirmation nobody answered is not a
 * confirmation, and `--yes` is how a script says so out loud.
 */
async function confirm(question: string): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await terminal.question(question)).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    terminal.close();
  }
}

const result = await run(process.argv.slice(2), process.cwd(), {
  env: process.env,
  io: {
    write: (line) => void process.stdout.write(`${line}\n`),
    ...(process.stdin.isTTY ? { confirm } : {}),
  },
});

if (result.lines.length > 0) {
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${result.lines.join("\n")}\n`);
}
process.exitCode = result.exitCode;
