import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DbService } from "../db/db.service";

/** Liveness signal: the API answers, and says whether it can reach its database. */
export interface HealthReport {
  status: "ok";
  db: "up" | "down";
}

@Injectable()
export class HealthService {
  constructor(private readonly database: DbService) {}

  async check(): Promise<HealthReport> {
    return { status: "ok", db: (await this.isDatabaseReachable()) ? "up" : "down" };
  }

  /** An unreachable database is reported, not thrown: health must always answer. */
  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.database.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }
}
