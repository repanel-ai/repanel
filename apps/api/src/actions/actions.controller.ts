import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import type { ActionResultDto, UserDto } from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ActionsService } from "./actions.service";

/**
 * The rendered admin's one write. It carries no body: an action has no inputs
 * in v0, so the address is the whole request and there is nothing to validate.
 */
@Controller("runtime/:projectKey/resources/:resourceKey/records/:id/actions")
@UseGuards(SessionAuthGuard)
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Post(":actionKey")
  run(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("resourceKey") resourceKey: string,
    @Param("id") id: string,
    @Param("actionKey") actionKey: string,
  ): Promise<ActionResultDto> {
    return this.actions.run(user.id, projectKey, resourceKey, id, actionKey);
  }
}
