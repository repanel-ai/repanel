import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { createProjectRequestSchema, type ProjectDto, type UserDto } from "@repanel/contracts";
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

  @Get()
  list(@CurrentUser() user: UserDto): Promise<ProjectDto[]> {
    return this.projects.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: UserDto, @Param("id", ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return this.projects.requireOwned(id, user.id);
  }
}
