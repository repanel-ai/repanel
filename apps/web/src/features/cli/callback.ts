/** Where the CLI listens. It is on this machine or it is not our CLI. */
const HOST = "127.0.0.1";

/**
 * The address the session token is handed back to, built from the port the CLI
 * asked us to answer on.
 *
 * The port is the only thing taken from the query string, and it is taken as a
 * number: the host is written here. A page that assembled this address out of
 * what the address bar carried could be pointed at any host on the internet,
 * and it would deliver a live session to it — which is the one thing this
 * hand-off must never be able to do.
 *
 * Nothing is returned when the request does not read as the CLI's: a missing
 * port, a port that is not a port, or no state to hand back with it.
 */
export function callbackUrl(
  port: string | null,
  state: string | null,
  token: string,
): string | undefined {
  if (state === null || state === "") return undefined;

  const listening = Number(port);
  if (!Number.isInteger(listening) || listening < 1 || listening > 65535) return undefined;

  const callback = new URL(`http://${HOST}:${listening}/`);
  callback.searchParams.set("state", state);
  callback.searchParams.set("token", token);
  return callback.toString();
}
