import { watch } from "node:fs";

/**
 * How long the definition has to stop changing before it is read again. An
 * editor saving a file writes it more than once, and a coding agent rewriting
 * four resources writes four files — one reassembly per burst, not per write.
 */
const SETTLE_MS = 80;

/**
 * Watches the definition directory and says when it has settled.
 *
 * Recursive because a resource is a file in a subdirectory, and because a file
 * appearing or disappearing changes the definition exactly as much as an edit
 * to one does.
 */
export function watchDefinition(directory: string, onSettled: () => void): () => void {
  let timer: NodeJS.Timeout | undefined;

  const watcher = watch(directory, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onSettled, SETTLE_MS);
    // The process should not be held open by a pending reassembly.
    timer.unref();
  });

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
