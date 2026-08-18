import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { DbModule } from "../db/db.module";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SessionAuthGuard } from "./session-auth.guard";

@Module({
  imports: [ConfigModule, DbModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, PasswordService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
