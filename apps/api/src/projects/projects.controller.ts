import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  createProjectRequestSchema,
  type ActionSecretDto,
  type ProjectDto,
  type ProjectMembershipDto,
  type UserDto,
} from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { ProjectsService } from "./projects.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class CreateProjectDto extends zodDto(createProjectRequestSchema) {}

@Controller("projects")
@UseGuards(SessionAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: UserDto, @Body() body: CreateProjectDto): Promise<ProjectDto> {
    return this.projects.create(user.id, body);
  }

  /** Everything this account may reach, and as what. Operators are on it too. */
  @Get()
  list(@CurrentUser() user: UserDto): Promise<ProjectMembershipDto[]> {
    return this.projects.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: UserDto, @Param("id", ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return this.projects.requireMember(id, user.id, "owner");
  }

  /** The one route that answers with a signing secret, and only to its owner. */
  @Get(":id/action-secret")
  actionSecret(
    @CurrentUser() user: UserDto,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ActionSecretDto> {
    return this.projects.revealActionSecret(id, user.id);
  }
}
