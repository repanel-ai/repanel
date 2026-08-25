import { recordWriteSchema, type Definition, type RecordWrite, type UserDto } from "@repanel/contracts";
import {
  NotFoundError,
  type ActionContext,
  type ActionRunner,
  type ReadContext,
  type RecordReader,
  type RecordWriter,
} from "@repanel/engine";
import { readListQuery } from "./query-params.js";
import { UnreadableBodyError } from "./request-body.js";

/**
 * Where the runtime's own requests arrive, after its client's `/api` prefix.
 * Matched without regard to case, because the hosted API is routed by Express,
 * which matches a route without regard to case — a request that reaches Nest
 * there must not reach the static app here.
 */
const API_PREFIX = "api";

/** Everything the local server can answer a runtime request out of. */
export interface RuntimeApi {
  /** The project key the local admin is served under; every path carries it. */
  readonly projectKey: string;
  /** The one operator. `repanel dev` has no accounts, so there is nobody else. */
  readonly user: UserDto;
  readonly reader: RecordReader;
  readonly writer: RecordWriter;
  readonly runner: ActionRunner;
  definition(): Definition;
  read(): ReadContext;
  act(): ActionContext;
}

/** A request this server recognized, and what it answers with. */
export interface ApiResponse {
  readonly body: unknown;
  /** What to answer with. Nest gives a bare `@Post` 201, and so does this. */
  readonly status: number;
}

/**
 * The runtime's data API, served from the same origin as the runtime itself.
 *
 * These are the hosted API's own paths, minus the half that has no meaning on
 * one developer's machine: there is no owner to check, no project to look up
 * and no stored draft to revalidate, because the definition came off the disk
 * a moment ago. What is left is the same reader and the same runner answering
 * the same addresses, which is what makes this the product rather than a
 * sibling of it.
 *
 * @returns what to answer, or `undefined` when the path is not an API path at
 *   all — then it belongs to the single-page app.
 */
export async function handleApi(
  api: RuntimeApi,
  method: string,
  url: URL,
  readBody: () => Promise<unknown> = () => Promise.resolve(undefined),
): Promise<ApiResponse | undefined> {
  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  if (segments[0]?.toLowerCase() !== API_PREFIX) return undefined;

  const path = segments.slice(1).map(decodeSegment);

  if (method === "GET" && path.length === 2 && path[0] === "auth" && path[1] === "me") {
    return { body: api.user, status: 200 };
  }

  if (path[0] !== "runtime") throw notFound(url);

  // A project that is not the one being served is answered the way the hosted
  // API answers a project you do not own: as one that is not there.
  if (path[1] !== api.projectKey) throw new NotFoundError("Project not found");

  const rest = path.slice(2);

  if (method === "GET" && rest.length === 1 && rest[0] === "definition") {
    return { body: api.definition(), status: 200 };
  }

  if (rest[0] !== "resources" || rest[2] !== "records") throw notFound(url);
  const resourceKey = rest[1] ?? "";

  if (method === "GET" && rest.length === 3) {
    return {
      status: 200,
      body: await api.reader.listRecords(api.read(), resourceKey, readListQuery(url.searchParams)),
    };
  }

  if (method === "POST" && rest.length === 3) {
    // 201, because the hosted route is a bare `@Post` and that is what Nest
    // answers a bare `@Post` with.
    return {
      status: 201,
      body: await api.writer.createRecord(api.read(), resourceKey, await write(readBody)),
    };
  }

  const id = rest[3] ?? "";

  if (method === "GET" && rest.length === 4) {
    return { status: 200, body: await api.reader.getRecord(api.read(), resourceKey, id) };
  }

  if (method === "PATCH" && rest.length === 4) {
    return {
      status: 200,
      body: await api.writer.updateRecord(api.read(), resourceKey, id, await write(readBody)),
    };
  }

  if (method === "GET" && rest.length === 6 && rest[4] === "related") {
    return {
      status: 200,
      body: await api.reader.listRelated(
        api.read(),
        resourceKey,
        id,
        rest[5] ?? "",
        readListQuery(url.searchParams),
      ),
    };
  }

  if (method === "POST" && rest.length === 6 && rest[4] === "actions") {
    // 201, because the hosted route is a bare `@Post` and that is what Nest
    // answers a bare `@Post` with. The runtime branches on `ok`, not on the
    // number, and the number is still the product's.
    return { status: 201, body: await api.runner.run(api.act(), resourceKey, id, rest[5] ?? "") };
  }

  throw notFound(url);
}

/**
 * The body of a write, read the way the hosted API's validation pipe reads it:
 * strictly, and answered with every problem at once. A key that could not name
 * a field is refused here, before anything looks one up.
 */
async function write(readBody: () => Promise<unknown>): Promise<RecordWrite> {
  const result = recordWriteSchema.safeParse(await readBody());
  if (result.success) return result.data;

  throw new UnreadableBodyError(
    result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; "),
  );
}

/**
 * Anything under `/api` that matches no route is a miss, never a fall-through:
 * an unmatched API path answered with the app's own HTML is a fetch that
 * fails somewhere far from the address that was wrong.
 */
function notFound(url: URL): NotFoundError {
  return new NotFoundError(`No route for \`${url.pathname}\``);
}

/** A path segment as the definition wrote it: `%20` was a space, not a segment. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A malformed escape is not a resource key either way, and the miss below
    // says so better than a crash does.
    return segment;
  }
}
