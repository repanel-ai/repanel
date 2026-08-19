import type { ConnectionDto } from "@repanel/contracts";
import type { ConnectionRow } from "./connections.repository";

/**
 * The only way a connection leaves the API. The DSN is passed in rather than
 * read off the row, which holds only its ciphertext — and it is passed in to be
 * taken apart, never carried on: the credential is in it. What comes out is
 * what a human needs to recognize the database they pointed us at.
 */
export function toConnectionDto(connection: ConnectionRow, dsn: string): ConnectionDto {
  const { hostname, pathname } = new URL(dsn);

  return {
    kind: connection.kind,
    host: hostname,
    database: pathname.slice(1),
  };
}
