import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Terminal } from "../terminal.js";
import { CloudError } from "./errors.js";

/** Loopback and nothing else: the browser is on this machine, and so is this. */
const HOST = "127.0.0.1";

/** Long enough to find the window, read the page, and type a password. */
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Signs this machine in, through the browser the operator is already signed in
 * to.
 *
 * The CLI cannot authenticate anybody and must never try: a command line that
 * asks for a password is a command line that has one in its history. So it
 * opens a port on loopback, sends the browser to the console with the port and
 * a nonce, and waits. The console — which has a session already — mints a
 * second one against it and redirects back here with it.
 *
 * The nonce is what makes the wait safe. Any page in that browser can navigate
 * to a loopback port, so a callback that does not carry the nonce this run
 * generated is not this run's callback, and is refused without ending the wait.
 *
 * @returns the session token the console handed back.
 */
export async function authorize(consoleUrl: string, terminal: Terminal): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  const server = createServer();
  await listen(server);

  const url = `${consoleUrl}/cli?port=${portOf(server)}&state=${encodeURIComponent(state)}`;
  terminal.write("Sign in to RePanel to authorize this machine:");
  terminal.write(`  ${url}`);
  terminal.write("");
  terminal.browse?.(url);

  try {
    return await waitForCallback(server, state);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/**
 * The one request this listener is open for. Everything else is answered and
 * forgotten: the wait ends when the console arrives with this run's nonce, and
 * a stray request must not be able to end it early or hold it open.
 */
function waitForCallback(server: Server, state: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new CloudError(
          "Gave up waiting for the browser to come back.",
          "Run `repanel link` again, and open the address it prints if your browser did not.",
        ),
      );
    }, TIMEOUT_MS);
    // The wait is the process's reason to be alive, not the timer's.
    timer.unref();

    server.on("request", (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(`http://${HOST}${request.url ?? "/"}`);
      const token = url.searchParams.get("token");

      if (url.pathname !== "/" || url.searchParams.get("state") !== state || !token) {
        return page(response, 400, "That did not come from this `repanel link`.");
      }

      page(response, 200, "This machine is linked. You can close this tab.");
      clearTimeout(timer);
      resolve(token);
    });
  });
}

function listen(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

/** The port the listener actually bound, which is the one the console must answer. */
function portOf(server: Server): number {
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new CloudError(
      "Could not open a port for the browser to answer on.",
      "Check that loopback connections are not blocked on this machine.",
    );
  }
  return address.port;
}

/** What the browser is left looking at. It carries nothing and asks for nothing. */
function page(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(
    `<!doctype html><meta charset="utf-8"><title>RePanel</title>` +
      `<body style="font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0">` +
      `<p>${message}</p>`,
  );
}
