import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import type { DefinitionStatusDto, UserDto } from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { DefinitionsService } from "./definitions.service";

/**
 * What the console asks about a definition. Reading one is the agent's job
 * through MCP; a human only ever needs to know how the last submission fared.
 */
@Controller("projects/:projectId/definition")
@UseGuards(SessionAuthGuard)
export class DefinitionsController {
  constructor(private readonly definitions: DefinitionsService) {}

  @Get("status")
  status(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<DefinitionStatusDto> {
    return this.definitions.status(user.id, projectId);
  }
}
