import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AgentPrincipal } from "../auth/principal";
import type { AgentRequest } from "./agent-token.guard";

/** The agent `AgentTokenGuard` resolved for this request. */
export const CurrentAgent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AgentPrincipal =>
    context.switchToHttp().getRequest<AgentRequest>().principal,
);
