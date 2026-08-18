import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { UserDto } from "@repanel/contracts";
import type { Request } from "express";
import { UnauthorizedError } from "../errors/domain-errors";
import { AuthService } from "./auth.service";
import { sessionTokenFrom } from "./session-cookie";

/** A request that has passed the guard. `@CurrentUser()` reads what it left. */
export interface AuthenticatedRequest extends Request {
  user: UserDto;
}

/** Turns the session cookie into the signed-in user, or refuses the request. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedError("Sign in to continue");

    request.user = await this.auth.userForSession(token);
    return true;
  }
}
