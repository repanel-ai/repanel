/** An agent token as the API returns it. The token itself is never in here. */
export interface AgentTokenDto {
  id: string;
  /** What the human called it, so they can tell one agent's token from another's. */
  label: string;
  /** ISO 8601: a DTO carries no `Date`, so browser and Node read it alike. */
  createdAt: string;
  /** ISO 8601, or null while the token has never opened an MCP session. */
  lastUsedAt: string | null;
}

/**
 * The one response that carries the token itself. Only its digest is stored,
 * so this response is the only copy that will ever exist.
 */
export interface MintedAgentTokenDto extends AgentTokenDto {
  /** `rpk_` followed by 40 random base62 characters. */
  token: string;
}
