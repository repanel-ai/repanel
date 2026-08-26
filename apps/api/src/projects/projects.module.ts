import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CryptoModule } from "../crypto/crypto.module";
import { DbModule } from "../db/db.module";
import { PeopleController } from "./people.controller";
import { PeopleService } from "./people.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";

/**
 * Projects, and who is on them. Membership is this feature's table because
 * authorization is this feature's job: every other feature asks it "may this
 * caller", and a members feature of its own would have to ask that question of
 * the feature that would be asking it back.
 */
@Module({
  imports: [AuthModule, CryptoModule, DbModule],
  controllers: [ProjectsController, PeopleController],
  providers: [ProjectsService, PeopleService, ProjectsRepository],
  exports: [ProjectsService],
})
export class ProjectsModule {}
