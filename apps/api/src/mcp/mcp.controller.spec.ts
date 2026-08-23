import type { INestApplication } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { ProjectDto, UserDto } from "@repanel/contracts";
import cookieParser from "cookie-parser";
import type { Response } from "express";
import { AgentTokenGuard } from "../agent-tokens/agent-token.guard";
import { AgentTokensService } from "../agent-tokens/agent-tokens.service";
import type { AgentPrincipal } from "../auth/principal";
import { AuthService } from "../auth/auth.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { UnauthorizedError } from "../errors/domain-errors";
import { DomainExceptionFilter } from "../errors/domain-exception.filter";
import { ProjectsController } from "../projects/projects.controller";
import { ProjectsService } from "../projects/projects.service";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

const LIVE_TOKEN = `rpk_${"a".repeat(40)}`;
const AGENT: AgentPrincipal = { kind: "agent", projectId: "project-crewbase" };
const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT: ProjectDto = {
  id: "project-crewbase",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

/**
 * The MCP route and one session route, served by the same application: the
 * bearer guard is bound to a controller, so the cookie routes must not notice
 * it at all.
 */
describe("McpController", () => {
  const handled: AgentPrincipal[] = [];
  let app: INestApplication;
  let url: string;

  const mcp = {
    handle(agent: AgentPrincipal, _request: unknown, response: Response): Promise<void> {
      handled.push(agent);
      response.status(200).json({ served: true });
      return Promise.resolve();
    },
  };

  const tokens = {
    principalFor(token: string): Promise<AgentPrincipal> {
      if (token !== LIVE_TOKEN) {
        return Promise.reject(new UnauthorizedError("Agent token is invalid"));
      }
      return Promise.resolve(AGENT);
    },
  };

  const auth = {
    userForSession(token: string): Promise<UserDto> {
      if (token !== "live-session") {
        return Promise.reject(new UnauthorizedError("Session is invalid or has expired"));
      }
      return Promise.resolve(USER);
    },
  };

  const projects = { list: () => Promise.resolve([PROJECT]) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController, ProjectsController],
      providers: [
        AgentTokenGuard,
        SessionAuthGuard,
        { provide: McpService, useValue: mcp },
        { provide: AgentTokensService, useValue: tokens },
        { provide: AuthService, useValue: auth },
        { provide: ProjectsService, useValue: projects },
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    handled.length = 0;
  });

  function postMcp(headers: Record<string, string> = {}): Promise<globalThis.Response> {
    return fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
  }

  it("hands the request to the MCP server as the agent behind the token", async () => {
    const response = await postMcp({ authorization: `Bearer ${LIVE_TOKEN}` });

    expect(response.status).toBe(200);
    expect(handled).toEqual([AGENT]);
  });

  it("refuses a request that carries no token, and serves nothing", async () => {
    const response = await postMcp();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
    expect(handled).toEqual([]);
  });

  it("refuses a token that does not hold", async () => {
    const response = await postMcp({ authorization: "Bearer rpk_nonsense" });

    expect(response.status).toBe(401);
    expect(handled).toEqual([]);
  });

  it("leaves the session routes alone: a cookie is still all they ask for", async () => {
    const response = await fetch(`${url}/projects`, {
      headers: { cookie: "repanel_session=live-session" },
    });

    // No Authorization header anywhere in this request, and none wanted.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([PROJECT]);
  });

  it("still refuses a session route to a caller with no session", async () => {
    const response = await fetch(`${url}/projects`);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Sign in to continue" },
    });
  });
});
