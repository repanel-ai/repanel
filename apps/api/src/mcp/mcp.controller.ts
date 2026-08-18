import { Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AgentTokenGuard } from "../agent-tokens/agent-token.guard";
import { CurrentAgent } from "../agent-tokens/current-agent.decorator";
import type { AgentPrincipal } from "../auth/principal";
import { McpService } from "./mcp.service";

/** The one route an agent token opens. The guard is bound here, never globally. */
@Controller("mcp")
@UseGuards(AgentTokenGuard)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  handle(
    @CurrentAgent() agent: AgentPrincipal,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.mcp.handle(agent, request, response);
  }
}
