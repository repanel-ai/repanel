import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AgentPrincipal } from "../auth/principal";
import { UnauthorizedError } from "../errors/domain-errors";
import { AgentTokensService } from "./agent-tokens.service";

/** A request that has passed the guard. `@CurrentPrincipal()` reads what it left. */
export interface AgentRequest extends Request {
  principal: AgentPrincipal;
}

const BEARER = "Bearer ";

/**
 * Turns the bearer token into the agent behind it, or refuses the request.
 * It establishes identity and stops there: every tool asks a service what that
 * agent may reach, so no route is protected by this guard alone.
 */
@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(private readonly tokens: AgentTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const token = bearerTokenFrom(request);
    if (!token) {
      throw new UnauthorizedError("Provide an agent token as `Authorization: Bearer rpk_...`");
    }

    request.principal = await this.tokens.principalFor(token);
    return true;
  }
}

/** The token a request carries, if it carries one. */
function bearerTokenFrom(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith(BEARER)) return undefined;

  const token = header.slice(BEARER.length).trim();
  return token === "" ? undefined : token;
}
