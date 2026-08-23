import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { RepanelModule } from "./repanel/repanel.module";

/**
 * Crewbase has no UI and, in this cut, no public API: what it has is a
 * database worth administering and one admin-API module RePanel can call.
 */
@Module({
  imports: [ConfigModule, DbModule, RepanelModule],
})
export class AppModule {}
