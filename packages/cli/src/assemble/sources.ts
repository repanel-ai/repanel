import { ROOT_PATH } from "@repanel/contracts";

/** Which file wrote which part of a composed definition. */
export interface DefinitionSource {
  /**
   * The path prefix this file supplied in the composed object: `""` for the
   * file holding the definition's own keys, `resources[2]` for a resource.
   */
  readonly path: string;
  /** The file, relative to the project root. */
  readonly file: string;
}

/** A problem's location, told in the terms the author wrote it in. */
export interface SourceLocation {
  readonly file: string;
  /** The path within that file; `ROOT_PATH` when the file itself is the subject. */
  readonly path: string;
}

/**
 * Translates a path in the composed definition back to a file and a path
 * inside it. This is the whole promise of the multi-file layout: a validator
 * that reports `resources[2].views.table.columns[0]` is describing an object
 * nobody wrote, and the author needs the file they can open.
 *
 * The longest matching prefix wins, so a resource's own file is preferred over
 * the file that supplied the root.
 */
export function locate(sources: readonly DefinitionSource[], path: string): SourceLocation {
  let best: DefinitionSource | undefined;
  for (const source of sources) {
    if (!covers(source.path, path)) continue;
    if (best === undefined || source.path.length > best.path.length) best = source;
  }
  if (best === undefined) return { file: sources[0]?.file ?? "", path };

  const remainder = path.slice(best.path.length).replace(/^\./, "");
  return { file: best.file, path: remainder === "" ? ROOT_PATH : remainder };
}

/**
 * Whether a prefix covers a path, on segment boundaries only — `resources[1]`
 * must not claim `resources[10].key`.
 */
function covers(prefix: string, path: string): boolean {
  if (prefix === "") return true;
  if (path === prefix) return true;
  return path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}
