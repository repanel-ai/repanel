import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { activityQuerySchema, type ActivityListDto, type UserDto } from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { ActivityService } from "./activity.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class ActivityQueryDto extends zodDto(activityQuerySchema) {}

/**
 * What has been done to one record. It hangs off the record rather than off the
 * project: v1 answers "what happened to this" and not "what has this operator
 * been doing", which is a console screen and is post-MVP.
 */
@Controller("runtime/:projectKey/resources/:resourceKey/records/:id/activity")
@UseGuards(SessionAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("resourceKey") resourceKey: string,
    @Param("id") id: string,
    @Query() query: ActivityQueryDto,
  ): Promise<ActivityListDto> {
    return this.activity.listForRecord(user.id, projectKey, resourceKey, id, query);
  }
}
