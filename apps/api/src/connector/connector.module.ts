import { Module } from "@nestjs/common";
import { ConnectorSocketsModule } from "../connector-sockets/connector-sockets.module";
import { DefinitionsModule } from "../definitions/definitions.module";
import { ProjectsModule } from "../projects/projects.module";
import { ConnectorService } from "./connector.service";

/**
 * What a connector is told. It depends on the socket transport, never the other
 * way round: the transport carries frames and this decides what an answer is.
 */
@Module({
  imports: [ConnectorSocketsModule, DefinitionsModule, ProjectsModule],
  providers: [ConnectorService],
})
export class ConnectorModule {}
