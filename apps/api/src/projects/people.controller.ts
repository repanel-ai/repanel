import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  addOperatorRequestSchema,
  type AddedPersonDto,
  type PersonDto,
  type UserDto,
} from "@repanel/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { zodDto } from "../validation/zod-dto";
import { PeopleService } from "./people.service";

/** Declared parameter type, so the global validation pipe knows what to parse. */
class AddOperatorDto extends zodDto(addOperatorRequestSchema) {}

/** Who may use this project's admin. Its owner decides, and only its owner. */
@Controller("projects/:projectId/people")
@UseGuards(SessionAuthGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<PersonDto[]> {
    return this.people.list(user.id, projectId);
  }

  /** The one response that carries a password, and only for a new account. */
  @Post()
  add(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() body: AddOperatorDto,
  ): Promise<AddedPersonDto> {
    return this.people.addOperator(user.id, projectId, body);
  }

  @Delete(":userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUser() user: UserDto,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.people.revoke(user.id, projectId, userId);
  }
}
