import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Where the CLI keeps what is its own: beside the operator, not the project. */
const DIRECTORY = ".repanel";
const FILE = "session.json";

/** Only its owner. A credential in a world-readable file is not a credential. */
const OWNER_ONLY = 0o600;
const OWNER_ONLY_DIRECTORY = 0o700;

/**
 * The one credential this CLI holds, and the deployment it belongs to.
 *
 * It is kept under the operator's home directory rather than in the
 * repository, because it is theirs and not the project's: two people working
 * on the same repository are two accounts, and nothing about a session should
 * ever reach a commit.
 */
export interface StoredSession {
  /** The API that issued it. A token is only ever sent back to its issuer. */
  readonly apiUrl: string;
  readonly token: string;
}

/** Where the session for this operator lives. */
export function sessionFile(home: string): string {
  return path.join(home, DIRECTORY, FILE);
}

/**
 * The session for this deployment, if one was stored for it. A token filed
 * against another API is not returned and not mentioned: pointing the CLI at a
 * second RePanel must not send the first one's credential to it.
 *
 * A file that cannot be read as a session is treated as no session at all.
 * There is nothing an operator could do about a corrupt one that signing in
 * again would not do better.
 */
export async function readSession(home: string, apiUrl: string): Promise<string | undefined> {
  let contents;
  try {
    contents = await readFile(sessionFile(home), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  const stored = parse(contents);
  return stored?.apiUrl === apiUrl ? stored.token : undefined;
}

/** Files the session, readable by its owner and nobody else. */
export async function writeSession(home: string, session: StoredSession): Promise<void> {
  const file = sessionFile(home);
  await mkdir(path.dirname(file), { recursive: true, mode: OWNER_ONLY_DIRECTORY });
  await writeFile(file, `${JSON.stringify(session, null, 2)}\n`, { mode: OWNER_ONLY });
  // `writeFile`'s mode applies to a file it creates; one that was already
  // there keeps whatever it had, which may be whatever created it.
  await chmod(file, OWNER_ONLY);
}

function parse(contents: string): StoredSession | undefined {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    return undefined;
  }

  if (typeof value !== "object" || value === null) return undefined;
  const { apiUrl, token } = value as Record<string, unknown>;
  if (typeof apiUrl !== "string" || typeof token !== "string" || token === "") return undefined;
  return { apiUrl, token };
}
