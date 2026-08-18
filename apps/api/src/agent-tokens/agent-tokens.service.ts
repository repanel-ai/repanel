import { Injectable } from "@nestjs/common";
import type {
  AgentTokenDto,
  CreateAgentTokenRequest,
  MintedAgentTokenDto,
} from "@repanel/contracts";
import type { AgentPrincipal } from "../auth/principal";
import { UnauthorizedError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { AGENT_TOKEN_PATTERN, createAgentToken, hashAgentToken } from "./agent-token";
import { toAgentTokenDto, toMintedAgentTokenDto } from "./agent-tokens.mapper";
import { AgentTokensRepository } from "./agent-tokens.repository";

/** One answer for every unusable token: a caller must not learn which part was wrong. */
const REFUSAL = "Agent token is invalid";

/**
 * Owns the tokens a project's coding agents connect with. Minting is a human's
 * act, so it is authorized as a human's: a token can never mint another token,
 * because nothing an agent can reach leads here.
 */
@Injectable()
export class AgentTokensService {
  constructor(
    private readonly repository: AgentTokensRepository,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Mints a token for a project its owner holds. The plaintext is returned
   * here and nowhere else, ever — only its digest is kept.
   */
  async mint(
    ownerId: string,
    projectId: string,
    { label }: CreateAgentTokenRequest,
  ): Promise<MintedAgentTokenDto> {
    await this.projects.requireOwned(projectId, ownerId);

    const token = createAgentToken();
    const created = await this.repository.create({
      projectId,
      label,
      tokenHash: hashAgentToken(token),
    });

    return toMintedAgentTokenDto(created, token);
  }

  /** A project's tokens as their owner sees them: labels and dates, no secrets. */
  async list(ownerId: string, projectId: string): Promise<AgentTokenDto[]> {
    await this.projects.requireOwned(projectId, ownerId);

    const tokens = await this.repository.listByProjectId(projectId);
    return tokens.map(toAgentTokenDto);
  }

  /**
   * The agent a token speaks for, or a refusal. Establishing who is calling is
   * all this does: what that agent may reach is the target service's decision.
   * A token no row carries — never minted, or deleted since — is invalid, which
   * is what makes deleting a row the way to revoke one.
   */
  async principalFor(token: string): Promise<AgentPrincipal> {
    // Shape is checked first, so a malformed header never reaches the database.
    if (!AGENT_TOKEN_PATTERN.test(token)) throw new UnauthorizedError(REFUSAL);

    const used = await this.repository.recordUse(hashAgentToken(token));
    if (!used) throw new UnauthorizedError(REFUSAL);

    return { kind: "agent", projectId: used.projectId };
  }
}
