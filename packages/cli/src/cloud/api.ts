import {
  SESSION_COOKIE,
  type ConnectionDto,
  type DefinitionSubmissionDto,
  type ErrorEnvelope,
  type ProjectDto,
  type ProjectMembershipDto,
  type UserDto,
} from "@repanel/contracts";
import { CloudError } from "./errors.js";

/**
 * Everything the CLI says to RePanel, and the only place in this package that
 * speaks to it at all.
 *
 * It holds a session token and sets it as the cookie a browser would carry, so
 * the API answers the CLI with the routes it already has and nothing about
 * being a command line is special-cased on the other side.
 *
 * The connection string passes through `connect` and stops there. It is never
 * logged, never put in an error, and never sent anywhere but the one API this
 * client was built for — the whole point of reading it here rather than
 * letting an agent handle it (DECISIONS #049).
 */
export class Cloud {
  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
  ) {}

  /** Who this machine is signed in as, or nobody. Being refused is an answer. */
  async whoami(): Promise<UserDto | undefined> {
    try {
      return await this.send<UserDto>("GET", "/auth/me");
    } catch (error) {
      if (error instanceof CloudError && error.status === 401) return undefined;
      throw error;
    }
  }

  /**
   * The projects this account owns.
   *
   * The route answers with everything the account may reach, operators' admins
   * included (task 029). Those are left out here: linking and deploying are the
   * owner's to do, so offering one would be offering a refusal.
   */
  async projects(): Promise<ProjectDto[]> {
    const memberships = await this.send<ProjectMembershipDto[]>("GET", "/projects");
    return memberships
      .filter((membership) => membership.role === "owner")
      .map((membership) => membership.project);
  }

  createProject(name: string): Promise<ProjectDto> {
    return this.send<ProjectDto>("POST", "/projects", { name });
  }

  /** Points a project at a database. What comes back names it; nothing repeats it. */
  connect(projectId: string, dsn: string): Promise<ConnectionDto> {
    return this.send<ConnectionDto>("PUT", `/projects/${projectId}/connection`, { dsn });
  }

  /** Replaces the project's whole definition, and answers with the verdict. */
  submit(projectId: string, definition: unknown): Promise<DefinitionSubmissionDto> {
    return this.send<DefinitionSubmissionDto>("PUT", `/projects/${projectId}/definition`, definition);
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response;
    try {
      response = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers: {
          cookie: `${SESSION_COOKIE}=${this.token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      // Whatever the platform's error says, what happened is that nothing
      // answered — and the address is the only part of it worth repeating.
      throw new CloudError(
        `Could not reach RePanel at ${this.apiUrl}.`,
        "Check that the deployment is running, or set `REPANEL_API_URL` to where it answers.",
      );
    }

    if (!response.ok) throw await this.refusal(response);
    const text = await response.text();
    return (text === "" ? undefined : JSON.parse(text)) as T;
  }

  /** A refusal in the API's own words, with the fix this CLI knows about. */
  private async refusal(response: Response): Promise<CloudError> {
    if (response.status === 401) {
      return new CloudError(
        "RePanel does not recognize this machine.",
        "Run `repanel link` to sign in again.",
        401,
      );
    }

    const message = await messageOf(response);
    return new CloudError(
      `RePanel refused the request: ${message}`,
      `The API at ${this.apiUrl} answered ${response.status}.`,
      response.status,
    );
  }
}

/** What the API said went wrong, or that it did not say. */
async function messageOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => undefined);
  if (typeof body !== "object" || body === null) return response.statusText || "no reason given";
  const { error } = body as Partial<ErrorEnvelope>;
  return typeof error?.message === "string" ? error.message : response.statusText;
}
