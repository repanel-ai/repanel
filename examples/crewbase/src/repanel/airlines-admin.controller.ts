import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { AirlinesService } from "../airlines/airlines.service";
import type { AirlineApproval } from "../airlines/airlines.repository";

/**
 * The admin API's airline routes. Transport only: the rule about which airlines
 * may be approved belongs to the airlines feature, and this file would be the
 * wrong place to learn it from.
 */
@Controller("repanel/airlines")
export class AirlinesAdminController {
  constructor(private readonly airlines: AirlinesService) {}

  // Nothing is created: the airline already existed and one column moved. Any
  // 2xx tells RePanel the action succeeded, so this is about telling the truth
  // to everything else that reads the status line.
  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  approve(@Param("id", ParseUUIDPipe) id: string): Promise<AirlineApproval> {
    return this.airlines.approve(id);
  }
}
