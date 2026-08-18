import type { AgentTokenDto, MintedAgentTokenDto } from "@repanel/contracts";
import type { AgentTokenRow } from "./agent-tokens.repository";

/** The only way a token row leaves the API. The digest stays behind. */
export function toAgentTokenDto(token: AgentTokenRow): AgentTokenDto {
  return {
    id: token.id,
    label: token.label,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
  };
}

/**
 * The minting response, and the only place a token's plaintext appears. It is
 * passed in rather than read from the row, because the row does not have it.
 */
export function toMintedAgentTokenDto(
  token: AgentTokenRow,
  plaintext: string,
): MintedAgentTokenDto {
  return { ...toAgentTokenDto(token), token: plaintext };
}
