import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where this package keeps the built runtime — the same bundle the hosted
 * product serves, copied in at build time and served here unmodified. There is
 * no local build of the app and no local variant of it: what differs locally
 * is what the server answers, never what the browser was given.
 */
export const EMBEDDED_RUNTIME = fileURLToPath(new URL("../runtime/", import.meta.url));

/** The dev channel's own two addresses, under a prefix no definition can claim. */
export const OVERLAY_PATH = "/@repanel-dev/overlay.js";
export const EVENTS_PATH = "/@repanel-dev/events";

const INDEX = "index.html";

/** Everything vite emits, and nothing else: a type we cannot name is not served. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Whether this package actually carries the app it is meant to serve. Checked
 * before a port is opened: a missing bundle is a broken install, and finding
 * out about it as a 500 in a browser tells the operator nothing.
 */
export async function hasRuntime(root: string): Promise<boolean> {
  try {
    await readFile(path.join(root, INDEX));
    return true;
  } catch {
    return false;
  }
}

export interface Asset {
  readonly contentType: string;
  readonly body: Buffer | string;
}

/**
 * One file out of the embedded app.
 *
 * A path that climbs out of the asset directory is not a miss but an attempt,
 * and it is answered as a miss anyway: this server is bound to loopback and
 * still has no business reading a file the app does not contain.
 */
export async function readAsset(root: string, pathname: string): Promise<Asset | undefined> {
  const extension = path.extname(pathname);
  const contentType = CONTENT_TYPES[extension];
  if (contentType === undefined) return undefined;

  const base = path.resolve(root);
  const file = path.resolve(base, `.${pathname}`);
  if (file !== base && !file.startsWith(base + path.sep)) return undefined;

  try {
    return { contentType, body: await readFile(file) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * The app's entry document, with the dev channel's client attached.
 *
 * The script is added as the document is served rather than built into the
 * bundle: the overlay is this command's, not the product's, and a runtime that
 * carried it would be a second build of the app with a development branch in
 * it. Read on every request, so an operator who rebuilds the runtime gets it.
 */
export async function readIndex(root: string): Promise<Asset> {
  const html = await readFile(path.join(root, INDEX), "utf8");
  return { contentType: CONTENT_TYPES[".html"] ?? "text/html", body: withOverlay(html) };
}

export function withOverlay(html: string): string {
  const script = `<script type="module" src="${OVERLAY_PATH}"></script>`;
  const closing = "</body>";
  return html.includes(closing) ? html.replace(closing, `  ${script}\n  ${closing}`) : html + script;
}

/**
 * The one route space the runtime draws: `/a/:projectKey/…` and nothing else
 * (`apps/runtime/src/app.tsx`). This server serves the same prefix it redirects
 * `/` to, and answers everything else that matched no file as a miss.
 */
const APP_ROUTES = "/a/";

/**
 * Whether a request that matched no file should be answered with the app.
 *
 * Decided by the route space rather than by whether the path looks like a
 * file: a record is addressed by its primary key, a primary key is often an
 * email or a dotted id, and `/a/local/r/users/maya.chen%40acme.com` ends in
 * something that reads exactly like a file extension. Guessing from the shape
 * of the last segment answers a real record's own address with a 404 — on a
 * refresh, on a shared link, and on every reload the overlay triggers.
 */
export function isAppRoute(pathname: string): boolean {
  return pathname.startsWith(APP_ROUTES);
}
