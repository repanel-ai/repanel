import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CryptoModule } from "../crypto/crypto.module";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { ConnectionProbeService } from "./connection-probe.service";
import { ConnectionsController } from "./connections.controller";
import { ConnectionsRepository } from "./connections.repository";
import { ConnectionsService } from "./connections.service";
import { CustomerPoolService } from "./customer-pool.service";

/** The pool service is exported for the query engine to read through; the DSN
 *  behind it is not exported anywhere, and never will be. */
@Module({
  imports: [AuthModule, CryptoModule, DbModule, ProjectsModule],
  controllers: [ConnectionsController],
  providers: [
    ConnectionsService,
    ConnectionsRepository,
    ConnectionProbeService,
    CustomerPoolService,
  ],
  exports: [ConnectionsService, CustomerPoolService],
})
export class ConnectionsModule {}
