import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { recordWriteSchema, type RecordDto, type UserDto } from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { RecordsService } from "./records.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class RecordWriteDto extends zodDto(recordWriteSchema) {}

/**
 * What the rendered admin's forms submit. `PATCH` rather than `PUT`, because an
 * update carries what changed and leaves the rest of the record alone.
 */
@Controller("runtime/:projectKey/resources/:resourceKey/records")
@UseGuards(SessionAuthGuard)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post()
  create(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("resourceKey") resourceKey: string,
    @Body() write: RecordWriteDto,
  ): Promise<RecordDto> {
    return this.records.createRecord(user, projectKey, resourceKey, write);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("resourceKey") resourceKey: string,
    @Param("id") id: string,
    @Body() write: RecordWriteDto,
  ): Promise<RecordDto> {
    return this.records.updateRecord(user, projectKey, resourceKey, id, write);
  }
}
