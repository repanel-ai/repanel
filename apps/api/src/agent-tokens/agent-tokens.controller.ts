import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  createAgentTokenRequestSchema,
  type AgentTokenDto,
  type MintedAgentTokenDto,
  type UserDto,
} from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { AgentTokensService } from "./agent-tokens.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class CreateAgentTokenDto extends zodDto(createAgentTokenRequestSchema) {}

@Controller("projects/:projectId/agent-tokens")
@UseGuards(SessionAuthGuard)
export class AgentTokensController {
  constructor(private readonly tokens: AgentTokensService) {}

  @Post()
  mint(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() body: CreateAgentTokenDto,
  ): Promise<MintedAgentTokenDto> {
    return this.tokens.mint(user.id, projectId, body);
  }

  @Get()
  list(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<AgentTokenDto[]> {
    return this.tokens.list(user.id, projectId);
  }
}
