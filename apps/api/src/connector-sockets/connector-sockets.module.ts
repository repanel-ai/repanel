import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { ConnectorSocketsService } from "./connector-sockets.service";
import { ConnectorTokensRepository } from "./connector-tokens.repository";

/**
 * The channel a customer's connector dials in on: cross-cutting transport, its
 * own module, exactly as the MCP transport and the database client are.
 *
 * It depends on no feature, which is the point. The connections feature mints
 * the tokens it authenticates with, the definitions feature announces a publish
 * through it, and the runtime feature serves requests over it — and none of
 * those has to know about any of the others, because what they share is a
 * socket rather than a meaning.
 */
@Module({
  imports: [DbModule],
  providers: [ConnectorSocketsService, ConnectorTokensRepository],
  exports: [ConnectorSocketsService, ConnectorTokensRepository],
})
export class ConnectorSocketsModule {}
