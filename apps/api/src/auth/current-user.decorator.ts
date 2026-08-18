import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { UserDto } from "@repanel/contracts";
import type { AuthenticatedRequest } from "./session-auth.guard";

/** The user `SessionAuthGuard` resolved for this request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserDto =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
