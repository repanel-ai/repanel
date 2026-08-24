/**
 * Every address of another RePanel surface the renderer writes down, and the
 * one file in this app allowed to hold one. It is read from the environment at
 * build time with the development port as its default (DECISIONS #040).
 */

/** Where an operator signs in; the runtime has no login screen of its own. */
export const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL ?? "http://localhost:5173";
