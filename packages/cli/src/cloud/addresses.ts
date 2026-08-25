/** Where a RePanel deployment answers. Two origins by design (DECISIONS #025). */
export interface Addresses {
  /** The API this machine submits to. */
  readonly api: string;
  /** The console, where a human signs in and authorizes this machine. */
  readonly console: string;
}

/** The development deployment, which is the one a checkout is pointed at. */
const DEFAULTS: Addresses = { api: "http://localhost:3001", console: "http://localhost:5173" };

/**
 * The deployment these commands talk to, read from the environment.
 *
 * There is one RePanel per deployment and it is named once, here, rather than
 * carried in `.repanel/project` — that file is committed, and a repository
 * that hard-codes somebody's staging API is a repository that deploys there by
 * accident.
 */
export function addressesFrom(env: NodeJS.ProcessEnv): Addresses {
  return {
    api: origin(env.REPANEL_API_URL, DEFAULTS.api),
    console: origin(env.REPANEL_CONSOLE_URL, DEFAULTS.console),
  };
}

/** A trailing slash dropped once, here, because addresses are built onto these. */
function origin(value: string | undefined, fallback: string): string {
  const stated = value?.trim();
  return (stated === undefined || stated === "" ? fallback : stated).replace(/\/+$/, "");
}
