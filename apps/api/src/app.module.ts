import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { DomainExceptionFilter } from "./errors/domain-exception.filter";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [AuthModule, ConfigModule, DbModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
