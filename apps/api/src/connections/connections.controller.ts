import { Body, Controller, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import {
  setConnectionRequestSchema,
  type ConnectionDto,
  type ConnectionTestDto,
  type UserDto,
} from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { ConnectionsService } from "./connections.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class SetConnectionDto extends zodDto(setConnectionRequestSchema) {}

@Controller("projects/:projectId/connection")
@UseGuards(SessionAuthGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Put()
  set(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() body: SetConnectionDto,
  ): Promise<ConnectionDto> {
    return this.connections.set(user.id, projectId, body);
  }

  @Post("test")
  test(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ConnectionTestDto> {
    return this.connections.test(user.id, projectId);
  }
}
