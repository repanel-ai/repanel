import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Where the repository writes down which project it deploys to. */
const DIRECTORY = ".repanel";
const FILE = "project";

/** The path an operator sees, and the one they commit. */
export const PROJECT_FILE = `${DIRECTORY}/${FILE}`;

/**
 * The project key this repository is linked to, or nothing.
 *
 * The file holds a key and nothing else. That is what makes it committable —
 * and it has to be committed, or the second person to clone the repository
 * deploys to a project of their own by accident. There is no token in it, no
 * connection string, and no address: a key names a project, and reaching that
 * project still takes a session this file knows nothing about.
 */
export async function readProjectKey(projectRoot: string): Promise<string | undefined> {
  let contents;
  try {
    contents = await readFile(path.join(projectRoot, DIRECTORY, FILE), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  const key = contents.trim();
  return key === "" ? undefined : key;
}

export async function writeProjectKey(projectRoot: string, key: string): Promise<void> {
  await mkdir(path.join(projectRoot, DIRECTORY), { recursive: true });
  await writeFile(path.join(projectRoot, DIRECTORY, FILE), `${key}\n`);
}
