#!/usr/bin/env node
import { run } from "./cli.js";

const result = await run(process.argv.slice(2), process.cwd());
if (result.lines.length > 0) {
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${result.lines.join("\n")}\n`);
}
process.exitCode = result.exitCode;
