/**
 * How a session travels. The cookie's name is wire, not implementation: the
 * API writes it, the console's browser carries it, and the CLI sets it by hand
 * on every request it makes — three surfaces that have to agree on one string.
 */
export const SESSION_COOKIE = "repanel_session";

/**
 * A session minted for the `repanel` CLI on somebody's machine, and the one
 * response that ever carries a session token in its body.
 *
 * The CLI is not a browser and holds no cookie jar, so it cannot be handed a
 * cookie; the console, which already has the session that authorized it, asks
 * for this on its behalf. It is an ordinary session in every other respect.
 */
export interface CliSessionDto {
  /** The token the CLI sends back as `SESSION_COOKIE`. Never printed. */
  token: string;
}
