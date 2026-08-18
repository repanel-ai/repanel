import type { UserDto } from "@repanel/contracts";
import type { Request, Response } from "express";
import { ConfigService } from "../config/config.service";
import type { Env } from "../config/env.schema";
import { AuthController } from "./auth.controller";
import { AuthService, type AuthenticatedSession } from "./auth.service";

const USER: UserDto = { id: "user-1", email: "ada@example.com", name: "Ada" };
const EXPIRES_AT = new Date("2026-09-17T12:00:00.000Z");
const SESSION: AuthenticatedSession = { user: USER, token: "raw-token", expiresAt: EXPIRES_AT };

describe("AuthController", () => {
  const endedSessions: (string | undefined)[] = [];

  function controllerFor(nodeEnv: Env["NODE_ENV"]): AuthController {
    const auth = {
      signup: () => Promise.resolve(SESSION),
      login: () => Promise.resolve(SESSION),
      logout: (token: string | undefined) => {
        endedSessions.push(token);
        return Promise.resolve();
      },
    } as unknown as AuthService;

    return new AuthController(auth, { nodeEnv } as ConfigService);
  }

  function responseSpy(): Response {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
  }

  beforeEach(() => {
    endedSessions.length = 0;
  });

  it("answers signup with the user and sends the session as a cookie", async () => {
    const response = responseSpy();

    await expect(controllerFor("development").signup(USER as never, response)).resolves.toEqual(
      USER,
    );
    expect(response.cookie).toHaveBeenCalledWith("repanel_session", "raw-token", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires: EXPIRES_AT,
    });
  });

  it("sends the same cookie on login", async () => {
    const response = responseSpy();

    await controllerFor("development").login(USER as never, response);

    expect(response.cookie).toHaveBeenCalledWith("repanel_session", "raw-token", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires: EXPIRES_AT,
    });
  });

  it("marks the cookie secure in production", async () => {
    const response = responseSpy();

    await controllerFor("production").login(USER as never, response);

    expect(response.cookie).toHaveBeenCalledWith(
      "repanel_session",
      "raw-token",
      expect.objectContaining({ secure: true }),
    );
  });

  it("ends the session the cookie names and clears it", async () => {
    const response = responseSpy();
    const request = { cookies: { repanel_session: "raw-token" } } as unknown as Request;

    await controllerFor("development").logout(request, response);

    expect(endedSessions).toEqual(["raw-token"]);
    expect(response.clearCookie).toHaveBeenCalledWith("repanel_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });

  it("answers /me with the user the guard resolved", () => {
    expect(controllerFor("development").me(USER)).toEqual(USER);
  });
});
