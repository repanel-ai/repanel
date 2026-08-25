import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { validateDefinition, type ProjectDto } from "@repanel/contracts";

/** One request the fake RePanel answered, as it arrived. */
export interface Received {
  readonly method: string;
  readonly path: string;
  readonly cookie: string | undefined;
  readonly body: unknown;
}

const HOST = "127.0.0.1";

/** Where this deployment would serve the rendered admin. */
const RUNTIME_URL = "http://127.0.0.1:5174";

/**
 * Stands in for RePanel: the four routes the CLI uses, on loopback, answering
 * the way the API answers — including refusing a session it does not know.
 *
 * A fake server rather than a stubbed `fetch`, because what these tests are
 * about is what leaves this machine. A stub would only prove `fetch` was
 * stubbed; this can be asked what actually arrived.
 */
export class FakeCloud {
  readonly received: Received[] = [];
  readonly projects: ProjectDto[] = [];
  /** The connection strings it was sent, which is the whole point of asking. */
  readonly connected: { projectId: string; dsn: string }[] = [];
  /** The definitions it was sent, most recent last. */
  readonly submitted: unknown[] = [];
  /** The session tokens it recognizes. */
  readonly sessions = new Set<string>();

  private readonly server: Server;
  private port = 0;

  constructor() {
    this.server = createServer((request, response) => {
      void this.answer(request, response);
    });
  }

  static async started(): Promise<FakeCloud> {
    const cloud = new FakeCloud();
    await cloud.listen();
    return cloud;
  }

  get url(): string {
    return `http://${HOST}:${this.port}`;
  }

  /** A session this fake will recognize, as the console's hand-off would leave one. */
  issue(token: string): string {
    this.sessions.add(token);
    return token;
  }

  add(project: ProjectDto): ProjectDto {
    this.projects.push(project);
    return project;
  }

  async close(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private listen(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server.listen(0, HOST, () => {
        const address = this.server.address();
        this.port = typeof address === "object" && address !== null ? address.port : 0;
        resolve();
      });
    });
  }

  private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(`http://${HOST}${request.url ?? "/"}`).pathname;
    const method = request.method ?? "GET";
    const cookie = request.headers.cookie;
    const body = await readBody(request);
    this.received.push({ method, path, cookie, body });

    const token = /repanel_session=([^;]+)/.exec(cookie ?? "")?.[1];
    if (token === undefined || !this.sessions.has(token)) {
      return send(response, 401, { error: { code: "unauthorized", message: "Sign in to continue" } });
    }

    if (method === "GET" && path === "/auth/me") {
      return send(response, 200, { id: "user-ada", email: "ada@example.com", name: "Ada" });
    }
    if (method === "GET" && path === "/projects") return send(response, 200, this.projects);
    if (method === "POST" && path === "/projects") {
      const name = (body as { name?: string }).name ?? "";
      const project: ProjectDto = {
        id: `id-${this.projects.length + 1}`,
        name,
        key: `${name.toLowerCase().replace(/\W+/g, "-")}-a3k9x2`,
        createdAt: "2026-08-25T09:00:00.000Z",
      };
      this.projects.push(project);
      return send(response, 201, project);
    }

    const connection = /^\/projects\/([^/]+)\/connection$/.exec(path);
    if (method === "PUT" && connection) {
      const dsn = (body as { dsn?: string }).dsn ?? "";
      this.connected.push({ projectId: connection[1] ?? "", dsn });
      // Exactly what `toConnectionDto` answers, port and all — which is to
      // say without it. A fake that is more generous than the API hides
      // whatever the API's own answer is missing.
      const { hostname, pathname } = new URL(dsn);
      return send(response, 200, { kind: "postgres", host: hostname, database: pathname.slice(1) });
    }

    const definition = /^\/projects\/([^/]+)\/definition$/.exec(path);
    if (method === "PUT" && definition) {
      this.submitted.push(body);
      const result = validateDefinition(body);
      const key = this.projects.find((project) => project.id === definition[1])?.key ?? "";
      return send(
        response,
        200,
        result.valid
          ? { valid: true, adminUrl: `${RUNTIME_URL}/a/${key}` }
          : { valid: false, errors: result.errors },
      );
    }

    return send(response, 404, { error: { code: "not_found", message: "Not found" } });
  }
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
