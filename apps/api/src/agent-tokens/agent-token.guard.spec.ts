import type { ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { AgentPrincipal } from "../auth/principal";
import { UnauthorizedError } from "../errors/domain-errors";
import { AgentTokenGuard, type AgentRequest } from "./agent-token.guard";
import { AgentTokensService } from "./agent-tokens.service";

const LIVE_TOKEN = `rpk_${"a".repeat(40)}`;
const AGENT: AgentPrincipal = { kind: "agent", projectId: "project-crewbase" };

describe("AgentTokenGuard", () => {
  const asked: string[] = [];
  let guard: AgentTokenGuard;

  /** Resolves one known token and refuses everything else, like the real service. */
  const tokens = {
    principalFor(token: string): Promise<AgentPrincipal> {
      asked.push(token);
      if (token !== LIVE_TOKEN) {
        return Promise.reject(new UnauthorizedError("Agent token is invalid"));
      }
      return Promise.resolve(AGENT);
    },
  };

  beforeEach(async () => {
    asked.length = 0;
    const moduleRef = await Test.createTestingModule({
      providers: [AgentTokenGuard, { provide: AgentTokensService, useValue: tokens }],
    }).compile();

    guard = moduleRef.get(AgentTokenGuard);
  });

  function requestWith(headers: Record<string, string>): {
    context: ExecutionContext;
    request: AgentRequest;
  } {
    const request = { headers } as unknown as AgentRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it("hands the request the agent behind the bearer token", async () => {
    const { context, request } = requestWith({ authorization: `Bearer ${LIVE_TOKEN}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual(AGENT);
  });

  it("establishes who is calling and nothing more", async () => {
    const { context, request } = requestWith({ authorization: `Bearer ${LIVE_TOKEN}` });

    await guard.canActivate(context);

    // The project on the request is the token's; deciding what may be done
    // with it is left to the services the tools call.
    expect(Object.keys(request.principal)).toEqual(["kind", "projectId"]);
  });

  it("refuses a request that carries no token, without asking the service", async () => {
    const { context } = requestWith({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(asked).toEqual([]);
  });

  it("refuses an authorization header that is not a bearer token", async () => {
    const { context } = requestWith({ authorization: `Basic ${LIVE_TOKEN}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(asked).toEqual([]);
  });

  it("refuses a bearer header with nothing after it", async () => {
    const { context } = requestWith({ authorization: "Bearer    " });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(asked).toEqual([]);
  });

  it("passes on the refusal when the token no longer holds", async () => {
    const { context, request } = requestWith({ authorization: `Bearer rpk_${"z".repeat(40)}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(request.principal).toBeUndefined();
    expect(asked).toEqual([`rpk_${"z".repeat(40)}`]);
  });
});
