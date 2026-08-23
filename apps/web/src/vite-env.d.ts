/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the API is reachable from outside the browser — the address an
   * agent's MCP client dials. The console itself talks to `/api` through the
   * dev proxy; this is the one the setup snippet is written with.
   */
  readonly VITE_API_URL?: string;
  /** Where the rendered admin is served. A different origin in dev (#025). */
  readonly VITE_RUNTIME_URL?: string;
}
