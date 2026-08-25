import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { AssemblyError } from "./errors.js";
import { navigationOrder, orderResourceKeys } from "./resource-order.js";
import type { DefinitionSource } from "./sources.js";

/** The directory a definition lives in, at the root of the customer's repo. */
export const DEFINITION_DIRECTORY = "repanel";

const SINGLE_FILE = "definition.json";
const APP_FILE = "app.json";
const RESOURCES_DIRECTORY = "resources";

export interface AssembledDefinition {
  /** The composed object, exactly as it would be submitted. Not yet validated. */
  readonly definition: unknown;
  /** Which file wrote which part, so a problem can be reported where it lives. */
  readonly sources: readonly DefinitionSource[];
}

/**
 * Composes the one object a submission is made of out of the files a customer
 * reviews. Two layouts, one convention: `repanel/definition.json` holding the
 * whole definition, or `repanel/app.json` plus one file per resource under
 * `repanel/resources/`, each named after the resource it holds.
 *
 * @param projectRoot the repository root — the directory `repanel/` sits in.
 * @throws AssemblyError when the files cannot be composed at all.
 */
export async function assembleDefinition(projectRoot: string): Promise<AssembledDefinition> {
  const single = await readJsonIfPresent(projectRoot, SINGLE_FILE);
  const app = await readJsonIfPresent(projectRoot, APP_FILE);

  if (single && app) {
    throw new AssemblyError(
      `\`${single.file}\` and \`${app.file}\` both exist; a definition is written one way or the other.`,
      `Delete \`${single.file}\` to keep the multi-file layout, or delete \`${app.file}\` and \`${DEFINITION_DIRECTORY}/${RESOURCES_DIRECTORY}/\` to keep the single file.`,
      DEFINITION_DIRECTORY,
    );
  }

  if (single) return { definition: single.value, sources: [{ path: "", file: single.file }] };

  if (!app) {
    throw new AssemblyError(
      `No definition found: \`${label(SINGLE_FILE)}\` and \`${label(APP_FILE)}\` are both missing.`,
      `Write \`${label(APP_FILE)}\` with \`schemaVersion\`, \`app\` and \`navigation\`, and one file per resource under \`${label(RESOURCES_DIRECTORY)}/\`. A small app may hold everything in \`${label(SINGLE_FILE)}\` instead.`,
      DEFINITION_DIRECTORY,
    );
  }

  return composeFromFiles(projectRoot, app);
}

async function composeFromFiles(projectRoot: string, app: JsonFile): Promise<AssembledDefinition> {
  if (!isObject(app.value)) {
    throw new AssemblyError(
      `\`${app.file}\` must hold a JSON object.`,
      `Write the definition's \`schemaVersion\`, \`app\` and \`navigation\` keys as one object; the resources live under \`${label(RESOURCES_DIRECTORY)}/\`.`,
      app.file,
    );
  }
  if ("resources" in app.value) {
    throw new AssemblyError(
      `\`${app.file}\` declares \`resources\`.`,
      `Move each resource into \`${label(RESOURCES_DIRECTORY)}/<key>.json\` and remove \`resources\` from \`${app.file}\`; the assembler composes the array.`,
      app.file,
    );
  }

  const files = await readResourceFiles(projectRoot);
  const byKey = new Map(files.map((resource) => [resource.key, resource]));
  const order = orderResourceKeys(navigationOrder(app.value), [...byKey.keys()]);

  const resources: unknown[] = [];
  const sources: DefinitionSource[] = [{ path: "", file: app.file }];
  for (const key of order) {
    const resource = byKey.get(key);
    if (!resource) continue;
    sources.push({ path: `resources[${resources.length}]`, file: resource.file });
    resources.push(resource.value);
  }

  return { definition: { ...app.value, resources }, sources };
}

interface ResourceFile extends JsonFile {
  /** The resource key the filename claims. */
  readonly key: string;
}

/**
 * Every resource file, each answering for its own name. The filename is the
 * resource key: it is what makes the directory readable, and what lets a
 * reviewer find the file an error is about. A file that disagrees with the
 * resource inside it is refused rather than quietly renamed — either half
 * could be the mistake, and only the author knows which.
 */
async function readResourceFiles(projectRoot: string): Promise<ResourceFile[]> {
  const directory = path.join(projectRoot, DEFINITION_DIRECTORY, RESOURCES_DIRECTORY);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (!isMissingFile(error)) throw error;
    throw new AssemblyError(
      `\`${label(RESOURCES_DIRECTORY)}/\` is missing, so \`${label(APP_FILE)}\` has no resources to compose.`,
      `Create \`${label(RESOURCES_DIRECTORY)}/\` with one file per resource, each named after its key.`,
      `${DEFINITION_DIRECTORY}/${RESOURCES_DIRECTORY}`,
    );
  }

  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) {
    throw new AssemblyError(
      `\`${label(RESOURCES_DIRECTORY)}/\` holds no \`.json\` files.`,
      `Add one file per resource, named after its key: \`${label(RESOURCES_DIRECTORY)}/users.json\` holds the resource \`users\`.`,
      `${DEFINITION_DIRECTORY}/${RESOURCES_DIRECTORY}`,
    );
  }

  const files: ResourceFile[] = [];
  for (const name of names) {
    const file = await readJson(projectRoot, `${RESOURCES_DIRECTORY}/${name}`);
    const key = name.slice(0, -".json".length);
    const declared = isObject(file.value) ? file.value.key : undefined;
    if (typeof declared === "string" && declared !== key) {
      throw new AssemblyError(
        `\`${file.file}\` holds the resource \`${declared}\`.`,
        `Rename the file to \`${declared}.json\`, or change the resource's \`key\` to \`${key}\`; a resource file is named after the resource it holds.`,
        file.file,
      );
    }
    files.push({ ...file, key });
  }
  return files;
}

interface JsonFile {
  /** The file, relative to the project root, as the author would type it. */
  readonly file: string;
  readonly value: unknown;
}

async function readJson(projectRoot: string, relative: string): Promise<JsonFile> {
  const file = label(relative);
  const contents = await readFile(path.join(projectRoot, DEFINITION_DIRECTORY, relative), "utf8");
  try {
    return { file, value: JSON.parse(contents) };
  } catch (error) {
    throw new AssemblyError(
      `\`${file}\` is not valid JSON: ${(error as Error).message}.`,
      `Fix the JSON syntax in \`${file}\`.`,
      file,
    );
  }
}

async function readJsonIfPresent(
  projectRoot: string,
  relative: string,
): Promise<JsonFile | undefined> {
  try {
    return await readJson(projectRoot, relative);
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

/** A path as the author would type it: `repanel/resources/users.json`. */
function label(relative: string): string {
  return `${DEFINITION_DIRECTORY}/${relative}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
