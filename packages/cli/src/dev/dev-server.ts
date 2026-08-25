import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { handleApi, type RuntimeApi } from "./api-routes.js";
import { failureOf } from "./failures.js";
import { readJsonBody } from "./request-body.js";
import type { DefinitionEvent, WatchedDefinition } from "./project.js";
import {
  EMBEDDED_RUNTIME,
  EVENTS_PATH,
  OVERLAY_PATH,
  isAppRoute,
  readAsset,
  readIndex,
} from "./spa.js";

/** This command's own client script, served beside the app rather than inside it. */
const DEV_CLIENT = fileURLToPath(new URL(".", import.meta.url));

/** Nothing here is cached: every answer is a fact about the disk a moment ago. */
const NO_STORE = { "cache-control": "no-store" } as const;

export interface DevServerOptions {
  readonly api: RuntimeApi;
  readonly watched: WatchedDefinition;
  /** The built runtime to serve. Defaults to the copy embedded in this package. */
  readonly assets?: string;
  /**
   * Told about a failure nothing recognized. The browser is answered the same
   * opaque envelope the hosted API answers with; the operator, who is sitting
   * at the terminal this is running in, is told what it actually was.
   */
  readonly onUnexpected?: (error: unknown) => void;
}

/**
 * The whole of `repanel dev` on the wire: the product's own runtime, the data
 * API it reads, and the channel that tells it the definition changed — one
 * origin, so the app's relative `/api` client reaches this server the way it
 * reaches the hosted one, with nothing about it built differently.
 */
export function createDevServer({
  api,
  watched,
  assets = EMBEDDED_RUNTIME,
  onUnexpected,
}: DevServerOptions): Server {
  const server = createServer((request, response) => {
    void respond(request, response).catch((error: unknown) => {
      onUnexpected?.(error);
      if (!response.headersSent) response.writeHead(500, { "content-type": "application/json", ...NO_STORE });
      response.end(JSON.stringify({ error: { code: "internal_error", message: "Internal server error" } }));
    });
  });

  async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    // Built as one absolute string rather than resolved against a base: a
    // request line beginning `//` would otherwise be read as a protocol-relative
    // address, and its first segment would become the host instead of the path.
    // The origin is a placeholder either way — the only parts ever read are the
    // path and the query.
    const url = new URL(`http://127.0.0.1${request.url ?? "/"}`);
    const method = request.method ?? "GET";

    if (url.pathname === EVENTS_PATH) return subscribe(request, response);

    if (url.pathname === OVERLAY_PATH) {
      const overlay = await readAsset(DEV_CLIENT, "/overlay.client.js");
      if (!overlay) return miss(response);
      return send(response, 200, "text/javascript; charset=utf-8", overlay.body);
    }

    // An admin opens on itself: there is one project here and the runtime's
    // routes all live under its key.
    if (url.pathname === "/") {
      response.writeHead(302, { location: `/a/${encodeURIComponent(api.projectKey)}/`, ...NO_STORE });
      response.end();
      return;
    }

    try {
      const answered = await handleApi(api, method, url, () => readJsonBody(request));
      if (answered) {
        return send(response, answered.status, "application/json; charset=utf-8", JSON.stringify(answered.body));
      }
    } catch (error) {
      const { status, body, unexpected } = failureOf(error);
      if (unexpected) onUnexpected?.(error);
      return send(response, status, "application/json; charset=utf-8", JSON.stringify(body));
    }

    const asset = await readAsset(assets, url.pathname);
    if (asset) return send(response, 200, asset.contentType, asset.body);

    // Every screen the runtime draws is a path with no file at the end of it.
    if (!isAppRoute(url.pathname)) return miss(response);

    const index = await readIndex(assets);
    return send(response, 200, index.contentType, index.body);
  }

  /**
   * The watch channel. A page that has just connected is told what is wrong
   * straight away — a reload during a broken edit must not come back looking
   * like everything is fine.
   */
  function subscribe(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      connection: "keep-alive",
      ...NO_STORE,
    });
    response.write(": connected\n\n");

    const announce = (event: DefinitionEvent): void => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const problems = watched.currentProblems;
    if (problems.length > 0) announce({ type: "problems", problems });

    const stop = watched.subscribe(announce);
    request.on("close", stop);
  }

  return server;
}

function send(response: ServerResponse, status: number, contentType: string, body: Buffer | string): void {
  response.writeHead(status, { "content-type": contentType, ...NO_STORE });
  response.end(body);
}

function miss(response: ServerResponse): void {
  send(response, 404, "application/json; charset=utf-8", JSON.stringify({
    error: { code: "not_found", message: "Not found" },
  }));
}
