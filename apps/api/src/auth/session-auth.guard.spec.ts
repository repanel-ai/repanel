import type { ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { UserDto } from "@repanel/contracts";
import { UnauthorizedError } from "../errors/domain-errors";
import { AuthService } from "./auth.service";
import { SessionAuthGuard, type AuthenticatedRequest } from "./session-auth.guard";

const USER: UserDto = { id: "user-1", email: "ada@example.com", name: "Ada" };

describe("SessionAuthGuard", () => {
  const asked: string[] = [];
  let guard: SessionAuthGuard;

  /** Resolves one known token and refuses everything else, like the real service. */
  const auth = {
    userForSession(token: string): Promise<UserDto> {
      asked.push(token);
      if (token !== "live-token") {
        return Promise.reject(new UnauthorizedError("Session is invalid or has expired"));
      }
      return Promise.resolve(USER);
    },
  };

  beforeEach(async () => {
    asked.length = 0;
    const moduleRef = await Test.createTestingModule({
      providers: [SessionAuthGuard, { provide: AuthService, useValue: auth }],
    }).compile();

    guard = moduleRef.get(SessionAuthGuard);
  });

  function requestWith(cookies: Record<string, string>): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } {
    const request = { cookies } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it("hands the request the user behind the session cookie", async () => {
    const { context, request } = requestWith({ repanel_session: "live-token" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(USER);
  });

  it("refuses a request that carries no session cookie, without asking the service", async () => {
    const { context } = requestWith({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(asked).toEqual([]);
  });

  it("passes on the refusal when the session no longer holds", async () => {
    const { context, request } = requestWith({ repanel_session: "stale-token" });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(request.user).toBeUndefined();
    expect(asked).toEqual(["stale-token"]);
  });
});
