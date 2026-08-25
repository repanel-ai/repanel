import type { UserDto } from "@repanel/contracts";
import type { Terminal } from "../terminal.js";
import type { Addresses } from "./addresses.js";
import { Cloud } from "./api.js";
import { authorize } from "./authorize.js";
import { CloudError } from "./errors.js";
import { readSession, writeSession } from "./session.js";

/** A signed-in machine: what to talk to RePanel through, and who it is. */
export interface SignedIn {
  readonly cloud: Cloud;
  readonly user: UserDto;
}

/**
 * Who this machine is, asking the browser if it does not already know.
 *
 * A stored session is offered to the API before it is trusted: a token can be
 * revoked, expire, or belong to a deployment that has since been reset, and
 * the only thing that knows is the API. Being refused is not an error here —
 * it is the answer "sign in again", which is what this then does.
 */
export async function signIn(
  addresses: Addresses,
  home: string,
  terminal: Terminal,
): Promise<SignedIn> {
  const stored = await readSession(home, addresses.api);
  if (stored !== undefined) {
    const cloud = new Cloud(addresses.api, stored);
    const user = await cloud.whoami();
    if (user) return { cloud, user };
  }

  const token = await authorize(addresses.console, terminal);
  const cloud = new Cloud(addresses.api, token);
  const user = await cloud.whoami();
  if (!user) {
    throw new CloudError(
      "RePanel did not recognize the session the console handed back.",
      "Run `repanel link` again.",
    );
  }

  await writeSession(home, { apiUrl: addresses.api, token });
  return { cloud, user };
}
