/**
 * Every address of another RePanel surface the console writes down, and the one
 * file in this app allowed to hold one. Each is read from the environment at
 * build time with the development port as its default, so a deployment states
 * where its surfaces live once and no screen carries a literal (DECISIONS #040).
 */

/**
 * Where the API answers from outside the browser. The console itself talks to
 * `/api` through the dev proxy and never uses this — it is what an agent's MCP
 * client has to dial, so it goes into the setup snippet rather than a request.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Where the rendered admin is served. Dev runs the two apps on two origins
 * (DECISIONS #025), so "Open admin" is an absolute link built from here rather
 * than a route this app knows how to render.
 */
export const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL ?? "http://localhost:5174";
