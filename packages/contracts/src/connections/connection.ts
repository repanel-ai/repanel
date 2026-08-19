/** The customer databases RePanel connects to. One kind, for now. */
export type ConnectionKind = "postgres";

/**
 * A project's customer database connection, as the API returns it. The DSN is
 * never in here and never will be: what a human needs to recognize which
 * database they pointed us at is the host and its name, and nothing else.
 */
export interface ConnectionDto {
  kind: ConnectionKind;
  host: string;
  /** The database the DSN names; validation refuses a DSN that names none. */
  database: string;
}

/**
 * Why a connection attempt failed, in categories a customer can act on. The
 * driver's own words are never passed on: they carry hosts, users, and — for
 * some failures — the credential itself.
 */
export type ConnectionFailureReason = "unreachable" | "auth_failed" | "timeout" | "unknown";

/** What `POST /projects/:id/connection/test` answers. */
export type ConnectionTestDto = { ok: true } | { ok: false; reason: ConnectionFailureReason };
