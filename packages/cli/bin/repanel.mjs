#!/usr/bin/env node
/**
 * The command, as pnpm sees it at install time.
 *
 * pnpm makes the `repanel` link while it is installing, which in a fresh clone
 * is before anything has been compiled. A `bin` naming `dist/bin.js` is
 * therefore a link pnpm cannot make — it warns, skips, and never comes back to
 * it, leaving a checkout whose command exists only after a second install.
 * Naming a committed file instead makes the link once, at a path that is
 * already there, and the build fills in what it points at.
 */
import { existsSync } from "node:fs";

const compiled = new URL("../dist/bin.js", import.meta.url);

if (existsSync(compiled)) {
  await import(compiled.href);
} else {
  process.stderr.write("repanel: nothing is built yet — run `pnpm -r build` from the repository root.\n");
  process.exitCode = 1;
}
