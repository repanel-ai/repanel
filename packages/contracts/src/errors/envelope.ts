import type { ValidationError } from "../definition/errors.js";

/**
 * The one shape a failed RePanel API response takes, whatever failed. Owned
 * here because three surfaces have to agree on it — the API writes it, the
 * console reads it, the runtime reads it — and a fourth copy of a wire shape is
 * a fourth chance for one of them to quietly drift.
 */
export interface ErrorEnvelope {
  error: {
    /** Stable and client-safe, e.g. `not_found`. Callers may branch on it. */
    code: string;
    /** Safe to show a human. Never carries a stack, an ORM message or an internal id. */
    message: string;
    /** Only a validation failure has these; every error carries the two fields above. */
    details?: readonly ValidationError[];
  };
}
