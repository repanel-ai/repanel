import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { CryptoService } from "./crypto.service";

/** Cross-cutting infrastructure: whatever a feature must not store in the clear. */
@Module({
  imports: [ConfigModule],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
