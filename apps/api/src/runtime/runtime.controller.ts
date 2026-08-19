import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  listRecordsQuerySchema,
  type Definition,
  type RecordDto,
  type RecordListDto,
  type UserDto,
} from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { RuntimeService } from "./runtime.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class ListRecordsQueryDto extends zodDto(listRecordsQuerySchema) {}

/** What the rendered admin reads. Everything it may read belongs to its owner. */
@Controller("runtime/:projectKey")
@UseGuards(SessionAuthGuard)
export class RuntimeController {
  constructor(private readonly runtime: RuntimeService) {}

  @Get("definition")
  definition(@CurrentUser() user: UserDto, @Param("projectKey") projectKey: string): Promise<Definition> {
    return this.runtime.definitionFor(user.id, projectKey);
  }

  @Get("resources/:key/records")
  records(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("key") key: string,
    @Query() query: ListRecordsQueryDto,
  ): Promise<RecordListDto> {
    return this.runtime.listRecords(user.id, projectKey, key, query);
  }

  @Get("resources/:key/records/:id")
  record(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("key") key: string,
    @Param("id") id: string,
  ): Promise<RecordDto> {
    return this.runtime.getRecord(user.id, projectKey, key, id);
  }

  @Get("resources/:key/records/:id/related/:relationshipKey")
  related(
    @CurrentUser() user: UserDto,
    @Param("projectKey") projectKey: string,
    @Param("key") key: string,
    @Param("id") id: string,
    @Param("relationshipKey") relationshipKey: string,
    @Query() query: ListRecordsQueryDto,
  ): Promise<RecordListDto> {
    return this.runtime.listRelated(user.id, projectKey, key, id, relationshipKey, query);
  }
}
