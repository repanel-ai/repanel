import type { CookieOptions, Request } from "express";
import type { Env } from "../config/env.schema";

/** The cookie a browser carries its session token in. */
export const SESSION_COOKIE = "repanel_session";

/**
 * The flags every session cookie is written and cleared with. `secure` is off
 * outside production only because local development speaks plain http.
 */
export function sessionCookieFlags(nodeEnv: Env["NODE_ENV"]): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: nodeEnv === "production" };
}

/** The session token a request carries, if it carries one. */
export function sessionTokenFrom(request: Request): string | undefined {
  const token: unknown = request.cookies?.[SESSION_COOKIE];
  return typeof token === "string" && token !== "" ? token : undefined;
}
