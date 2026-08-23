/** A project as the API returns it. Who owns it is not the wire's business. */
export interface ProjectDto {
  id: string;
  name: string;
  /** Stable routing identity, e.g. `crewbase-a3k9x2`. Fixed at creation. */
  key: string;
  /** ISO 8601: a DTO carries no `Date`, so browser and Node read it alike. */
  createdAt: string;
}

/**
 * The one response that carries a project's action-signing secret. It is stored
 * encrypted and shown here alone, because the customer application needs the
 * same value to verify what RePanel sends it (DECISIONS #013) and there is
 * nowhere else it could come from.
 */
export interface ActionSecretDto {
  /** The HMAC key, verbatim — the same bytes both sides feed to sha256. */
  secret: string;
}
