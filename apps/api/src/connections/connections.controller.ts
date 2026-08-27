import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import {
  setConnectionRequestSchema,
  type ConnectionDto,
  type ConnectionTestDto,
  type MintedConnectorTokenDto,
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

  /** Nothing in the body when there is no connection: that is the "or null". */
  @Get()
  get(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ConnectionDto | null> {
    return this.connections.get(user.id, projectId);
  }

  @Put()
  set(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() body: SetConnectionDto,
  ): Promise<ConnectionDto> {
    return this.connections.set(user.id, projectId, body);
  }

  /**
   * Puts this project on the connector rung and mints the token its connector
   * dials with. `POST` because it mints: asking twice mints twice, and the
   * second one revokes the first.
   */
  @Post("connector")
  useConnector(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<MintedConnectorTokenDto> {
    return this.connections.useConnector(user.id, projectId);
  }

  @Post("test")
  test(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ConnectionTestDto> {
    return this.connections.test(user.id, projectId);
  }
}
