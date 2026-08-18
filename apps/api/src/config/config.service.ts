import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import type { Env } from "./env.schema";

/** The only typed view of the environment. Nothing else in `src/` reads `process.env`. */
@Injectable()
export class ConfigService {
  constructor(private readonly env: NestConfigService<Env, true>) {}

  get nodeEnv(): Env["NODE_ENV"] {
    return this.env.get("NODE_ENV", { infer: true });
  }

  get port(): number {
    return this.env.get("PORT", { infer: true });
  }

  get databaseUrl(): string {
    return this.env.get("DATABASE_URL", { infer: true });
  }
}
