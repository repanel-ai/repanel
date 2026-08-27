/**
 * How RePanel reaches a project's database, and the two answers there are.
 *
 * `postgres-direct` is the default onboarding rung: the customer hands RePanel
 * a connection string and RePanel dials the database. `connector` is the rung
 * above it: an open-source binary runs beside the database, holds the string
 * locally and dials RePanel, which then sends definition-derived descriptors
 * and never SQL (DECISIONS #064). One project points one way at a time.
 */
export type ConnectionKind = "postgres-direct" | "connector";

/**
 * A project's database as RePanel dials it. The DSN is never in here and never
 * will be: what a human needs to recognize which database they pointed us at is
 * the host and its name, and nothing else.
 */
export interface DirectConnectionDto {
  kind: "postgres-direct";
  host: string;
  /** The database the DSN names; validation refuses a DSN that names none. */
  database: string;
}

/**
 * A project served through a connector. There is no host and no database name
 * here because RePanel does not know them — that is the entire point of this
 * rung. What it can say is whether the connector is there, which it knows from
 * the heartbeat and from nothing else.
 */
export interface ConnectorConnectionDto {
  kind: "connector";
  /** Whether a connector is holding a channel open right now. */
  connected: boolean;
  /** ISO 8601: the last heartbeat, or null while none has ever arrived. */
  lastSeenAt: string | null;
}

/** A project's customer database connection, as the API returns it. */
export type ConnectionDto = DirectConnectionDto | ConnectorConnectionDto;

/**
 * The one response that carries a connector token. Only its digest is stored,
 * so this response is the only copy that will ever exist — the same promise an
 * agent token is minted under, and for the same reason.
 */
export interface MintedConnectorTokenDto {
  /** `rpc_` followed by 40 random base62 characters. */
  token: string;
}

/**
 * Why a connection attempt failed, in categories a customer can act on. The
 * driver's own words are never passed on: they carry hosts, users, and — for
 * some failures — the credential itself.
 */
export type ConnectionFailureReason = "unreachable" | "auth_failed" | "timeout" | "unknown";

/** What `POST /projects/:id/connection/test` answers. */
export type ConnectionTestDto = { ok: true } | { ok: false; reason: ConnectionFailureReason };
