import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { ConfigService } from "./config.service";
import { validateEnv } from "./env.schema";

@Module({
  imports: [NestConfigModule.forRoot({ validate: validateEnv })],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
