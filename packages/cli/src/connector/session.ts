import { validateDefinition, type Definition } from "@repanel/contracts";

/** What a connector is serving right now, or nothing yet. */
export interface ServedDefinition {
  version: number;
  definition: Definition;
}

/** Cloud sent a definition that does not validate — the same check it made. */
export class UnservableDefinition extends Error {}

/**
 * Everything a connector knows, and everywhere it keeps it: here, in memory,
 * for as long as the process runs.
 *
 * Nothing in this file reaches a disk and nothing in this package writes one.
 * The connection string comes from the environment the operator started it in,
 * the definition comes down the channel and is replaced when a newer one is
 * published, and the signing secret arrives once when the session opens. A
 * connector that is stopped leaves nothing behind, and a connector that is
 * started is current within one round trip — which is what makes restarting it
 * the whole of its operations story (DECISIONS #064).
 */
export class ConnectorSession {
  private served?: ServedDefinition;
  private signing = "";

  /** What is being served, or nothing — a project may publish after we connect. */
  get current(): ServedDefinition | undefined {
    return this.served;
  }

  /** The version being served; 0 before there is one, which is what a heartbeat says. */
  get version(): number {
    return this.served?.version ?? 0;
  }

  /** The project's action signing secret, as handed over when the session opened. */
  get secret(): string {
    return this.signing;
  }

  /** Opens a session: the secret for as long as it lasts, and what to serve. */
  open(secret: string, published: { version: number; payload: unknown } | null): void {
    this.signing = secret;
    this.serve(published);
  }

  /**
   * Takes a published definition, validated exactly as Cloud validates it
   * before serving a request out of it. A definition that does not validate is
   * refused rather than half-served: the two ends have to agree about what the
   * admin is, or a descriptor means different things at each end.
   */
  serve(published: { version: number; payload: unknown } | null): void {
    if (!published) {
      this.served = undefined;
      return;
    }

    const result = validateDefinition(published.payload);
    if (!result.valid) {
      throw new UnservableDefinition(
        `Version ${published.version} of this project's definition does not validate, so it cannot be served.`,
      );
    }

    this.served = { version: published.version, definition: result.definition };
  }

  /** Everything goes when the channel does: a new session opens a new one. */
  close(): void {
    this.served = undefined;
    this.signing = "";
  }
}
