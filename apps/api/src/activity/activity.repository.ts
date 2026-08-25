import { Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { auditEvents } from "../db/schema";

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;

/** One record's own history, and how much of it there is. */
export interface AuditEventPage {
  rows: AuditEventRow[];
  total: number;
}

/**
 * All Drizzle access to the table the activity feature owns.
 *
 * It inserts and it reads, and that is deliberately the whole surface: there is
 * no method here that changes a row or removes one. A log an operator can edit
 * answers "who did this" with whatever the last person to touch it wanted it to
 * say, so the way to correct the record is to do something else and have that
 * recorded too.
 */
@Injectable()
export class ActivityRepository {
  constructor(private readonly database: DbService) {}

  async insert(event: NewAuditEventRow): Promise<AuditEventRow> {
    const [filed] = await this.database.db.insert(auditEvents).values(event).returning();
    if (!filed) throw new Error("Filing an audit event returned no row");
    return filed;
  }

  /**
   * A page of one record's events, newest first, and the count that says how
   * many there are to page through. Both are narrowed by the project as well as
   * by the record: a resource key and a primary key are the customer's own
   * vocabulary, and two projects are perfectly entitled to share them.
   */
  async listForRecord(
    projectId: string,
    resourceKey: string,
    recordPk: string,
    page: number,
    pageSize: number,
  ): Promise<AuditEventPage> {
    const of = and(
      eq(auditEvents.projectId, projectId),
      eq(auditEvents.resourceKey, resourceKey),
      eq(auditEvents.recordPk, recordPk),
    );

    const [rows, [counted]] = await Promise.all([
      this.database.db
        .select()
        .from(auditEvents)
        .where(of)
        // The clock, then the key. Two events filed in the same millisecond are
        // otherwise free to swap places between one page and the next, which is
        // where a page boundary shows one twice and the other not at all.
        .orderBy(desc(auditEvents.at), desc(auditEvents.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database.db.select({ total: count() }).from(auditEvents).where(of),
    ]);

    return { rows, total: counted?.total ?? 0 };
  }
}
