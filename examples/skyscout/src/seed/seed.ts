import { NestFactory } from "@nestjs/core";
import { sql } from "drizzle-orm";
import { AppModule } from "../app.module";
import { DbService } from "../db/db.service";
import { airlines, applications, candidates, jobOpenings, users } from "../db/schema";
import { seedRows } from "./rows";

/**
 * Fills an empty SkyScout with something worth administering.
 *
 * It runs through the application's own context rather than a connection of its
 * own, so a seed against a misconfigured environment fails at the same place a
 * boot would, with the same message.
 */
async function seed(): Promise<void> {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const { db } = context.get(DbService);
  const rows = seedRows();

  // Re-runnable on purpose: seeding twice is something everyone does once.
  await db.execute(
    sql`truncate table ${applications}, ${jobOpenings}, ${candidates}, ${airlines}, ${users} restart identity cascade`,
  );

  await db.insert(users).values(rows.users);
  await db.insert(airlines).values(rows.airlines);
  await db.insert(candidates).values(rows.candidates);
  await db.insert(jobOpenings).values(rows.openings);
  await db.insert(applications).values(rows.applications);

  const written =
    rows.users.length +
    rows.airlines.length +
    rows.candidates.length +
    rows.openings.length +
    rows.applications.length;

  console.log(
    `Seeded ${written} rows: ${rows.users.length} users, ${rows.airlines.length} airlines, ` +
      `${rows.candidates.length} candidates, ${rows.openings.length} job openings, ` +
      `${rows.applications.length} applications.`,
  );

  await context.close();
}

void seed();
