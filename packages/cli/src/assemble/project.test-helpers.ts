import { saasDefinition } from "@repanel/contracts/fixtures";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Writes a throwaway project. Keys are paths under `repanel/`; a string value
 * is written verbatim, so a test can seed a file that is not JSON at all.
 */
export async function writeProject(files: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "repanel-cli-"));
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(root, "repanel", relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof contents === "string" ? contents : JSON.stringify(contents, null, 2));
  }
  return root;
}

export async function removeProject(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

/** The reference definition, laid out the way the multi-file convention wants it. */
export function multiFileLayout(): Record<string, unknown> {
  const { resources, ...app } = structuredClone(saasDefinition);
  const files: Record<string, unknown> = { "app.json": app };
  for (const resource of resources) files[`resources/${resource.key}.json`] = resource;
  return files;
}
