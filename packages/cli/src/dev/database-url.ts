import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

/** The files an application keeps its own environment in, most specific first. */
const ENV_FILES = [".env.local", ".env"] as const;

const KEY = "DATABASE_URL";

/** What stands in for a password wherever one would otherwise be printed. */
const MASK = "****";

export interface DatabaseUrl {
  readonly url: string;
  /** Where it was found, worded for the confirmation: `.env`, `--database-url`. */
  readonly origin: string;
  /**
   * Whether the operator has already said this is the one. A value they typed
   * is an answer; a value found in a file is a guess that has to be checked.
   */
  readonly answered: boolean;
}

/**
 * The database the admin will read, found the way a developer would look:
 * what they typed, then what their shell already holds, then the application's
 * own env files.
 *
 * The files are read, never loaded: nothing here writes `process.env`, so a
 * DSN found for one command does not silently become the default for whatever
 * the process does next.
 */
export async function findDatabaseUrl(
  projectRoot: string,
  flag: string | undefined,
  env: NodeJS.ProcessEnv,
): Promise<DatabaseUrl | undefined> {
  if (flag !== undefined) return { url: flag, origin: "--database-url", answered: true };

  const fromShell = env[KEY];
  if (fromShell) return { url: fromShell, origin: `${KEY} in your environment`, answered: true };

  for (const file of ENV_FILES) {
    const url = await readKey(path.join(projectRoot, file));
    if (url !== undefined) return { url, origin: file, answered: false };
  }

  return undefined;
}

async function readKey(file: string): Promise<string | undefined> {
  let contents;
  try {
    contents = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const value = parseEnv(contents)[KEY];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * A DSN with its password taken out, for the one place a DSN is shown to a
 * human. The rest is left byte for byte: an operator confirming a database has
 * to recognize the host, the port and the name, and a rewritten string is a
 * string they have to squint at.
 *
 * Both spellings are covered — the URL form and libpq's keyword form — because
 * a password printed once is a password in a scrollback buffer for good.
 */
export function maskDatabaseUrl(url: string): string {
  try {
    const { password } = new URL(url);
    if (password !== "") return url.replace(`:${password}@`, `:${MASK}@`);
  } catch {
    // Not a URL, so it is the keyword form or something we do not recognize.
    // Either way the regex below is the only defence there is.
  }
  return url.replace(/password=[^\s]+/gi, `password=${MASK}`);
}

/** How the database is named in the banner: enough to recognize, no secret. */
export function describeDatabase(url: string): string {
  try {
    const { hostname, port, pathname } = new URL(url);
    const name = pathname.replace(/^\//, "");
    const host = port === "" ? hostname : `${hostname}:${port}`;
    return name === "" ? host : `${name}@${host}`;
  } catch {
    return maskDatabaseUrl(url);
  }
}
