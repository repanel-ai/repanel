import type { ConnectionDto } from "@repanel/contracts";
import type { ConnectionRow } from "./connections.repository";

/** What a live connector last said, as the transport knows it. */
export interface ConnectorPresence {
  connected: boolean;
  /** The live heartbeat if there is one, else the last one that was filed. */
  lastSeenAt: Date | null;
}

/**
 * The only way a connection leaves the API.
 *
 * A direct connection's DSN is passed in rather than read off the row, which
 * holds only its ciphertext — and it is passed in to be taken apart, never
 * carried on: the credential is in it. What comes out is what a human needs to
 * recognize the database they pointed us at.
 *
 * A connector connection has none of that to say, because RePanel does not know
 * it. What it has instead is whether the connector is there, which is the thing
 * a human on that rung actually needs to see.
 */
export function toConnectionDto(
  connection: ConnectionRow,
  detail: { dsn: string } | ConnectorPresence,
): ConnectionDto {
  if ("dsn" in detail) {
    const { hostname, pathname } = new URL(detail.dsn);
    return { kind: "postgres-direct", host: hostname, database: pathname.slice(1) };
  }

  return {
    kind: "connector",
    connected: detail.connected,
    lastSeenAt: detail.lastSeenAt?.toISOString() ?? null,
  };
}
