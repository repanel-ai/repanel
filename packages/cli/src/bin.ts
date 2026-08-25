#!/usr/bin/env node
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { run } from "./cli.js";
import { colorsAllowed } from "./terminal.js";

/**
 * Asks the operator a yes/no question, defaulting to yes on an empty line.
 * Absent when there is no terminal: a confirmation nobody answered is not a
 * confirmation, and `--yes` is how a script says so out loud.
 */
async function confirm(question: string): Promise<boolean> {
  const answer = (await prompt(question)).trim().toLowerCase();
  return answer === "" || answer === "y" || answer === "yes";
}

/** Asks for a line of text. An empty line is an answer: it means "the default". */
function ask(question: string): Promise<string> {
  return prompt(question);
}

async function prompt(question: string): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(question);
  } finally {
    terminal.close();
  }
}

/** How each platform is asked to open an address. */
const OPENERS: Partial<Record<NodeJS.Platform, readonly string[]>> = {
  darwin: ["open"],
  win32: ["cmd", "/c", "start", ""],
};

/**
 * Opens an address in whatever this machine considers the browser, and does
 * not mind failing. The address is always printed as well, so a browser that
 * will not open is an inconvenience rather than a dead end.
 */
function browse(url: string): void {
  const [command = "xdg-open", ...args] = OPENERS[process.platform] ?? [];
  try {
    spawn(command, [...args, url], { stdio: "ignore", detached: true }).unref();
  } catch {
    // Printed already; there is nothing to say and nothing to do.
  }
}

// Everything a human answers is here or nowhere: no terminal, no questions.
const human = process.stdin.isTTY ? { confirm, ask, browse } : {};

const result = await run(process.argv.slice(2), process.cwd(), {
  env: process.env,
  home: homedir(),
  io: {
    write: (line) => void process.stdout.write(`${line}\n`),
    // Where the lines are going decides whether they may be coloured, and it
    // is decided here because this is the only place that knows.
    colors: colorsAllowed(process.stdout.isTTY === true, process.env),
    ...human,
  },
});

if (result.lines.length > 0) {
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${result.lines.join("\n")}\n`);
}
process.exitCode = result.exitCode;
