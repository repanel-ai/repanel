import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import type { DefinitionStatusDto, DefinitionSubmissionDto, UserDto } from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { DefinitionsService } from "./definitions.service";

/**
 * What a human does with a definition. Reading one back is the agent's job
 * through MCP; a human asks how the last submission fared, and — from
 * `repanel deploy` — makes one of their own out of the files in their
 * repository.
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

  /**
   * The whole definition, replacing whatever was there. The body is passed on
   * unparsed: what a definition may contain is the definition schema's to say,
   * and it says it in errors this answers with rather than in a 400.
   */
  @Put()
  submit(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() payload: unknown,
  ): Promise<DefinitionSubmissionDto> {
    return this.definitions.submit(user.id, projectId, payload);
  }
}
