import { SESSION_COOKIE } from "@repanel/contracts";
import type { CookieOptions, Request } from "express";
import type { Env } from "../config/env.schema";

/**
 * The cookie a browser carries its session token in. Its name is the wire's,
 * not this feature's: the CLI sets the same header by hand, so the string is
 * declared once in `@repanel/contracts` and read here.
 */
export { SESSION_COOKIE };

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
