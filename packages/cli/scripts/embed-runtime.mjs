/**
 * Copies the built runtime into this package, so `repanel dev` serves the same
 * bundle the hosted product does rather than building one of its own.
 *
 * It is a copy rather than a build because a customer installs this package,
 * not this repository: shipping the app's source plus a bundler so the CLI
 * could rebuild it would put a second build of the product on their machine,
 * and a second build is a second product. `@repanel/runtime` is a
 * devDependency purely so pnpm builds it before this runs.
 *
 * The overlay is copied for a different reason: it is this command's own
 * client, plain JavaScript that tsc never compiles because it never typechecks
 * it, so nothing else would put it in `dist/`.
 */
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const runtimeDist = path.resolve(packageRoot, "../../apps/runtime/dist");
const embedded = path.join(packageRoot, "dist/runtime");

await mkdir(path.dirname(embedded), { recursive: true });
await cp(runtimeDist, embedded, { recursive: true });
await cp(
  path.join(packageRoot, "src/dev/overlay.client.js"),
  path.join(packageRoot, "dist/dev/overlay.client.js"),
);

const files = await readdir(embedded);
if (!files.includes("index.html")) {
  throw new Error(`${runtimeDist} holds no index.html; build @repanel/runtime first.`);
}
