import { randomUUID } from "node:crypto";
import type {
  ActivityEventDto,
  ActivityListDto,
  ActivityQuery,
  RecordId,
  UserDto,
} from "@repanel/contracts";
import type { AuditEvent } from "@repanel/engine";

/** One event, and the record it is about, kept together so a page can find it. */
interface Filed {
  resourceKey: string;
  recordPk: string | null;
  event: ActivityEventDto;
}

/**
 * What this run of `repanel dev` has done, newest first.
 *
 * It is the hosted `audit_events` table's local stand-in, and it lives in
 * memory: there is no control-plane database on a developer's machine, and
 * writing a log file into their repository would be RePanel putting something
 * there that nothing asked for (DECISIONS #058). So it goes when the process
 * does, which is also honest about what it is for — seeing the panel work
 * against real rows before any of this is deployed.
 *
 * What it is not is a second implementation of the rules. The engine decides
 * what an event says and whether a write may be reported at all; this only
 * files what it is handed, exactly as the hosted service does (DECISIONS #061).
 */
export class ActivityLog {
  private readonly filed: Filed[] = [];

  /** Files what the engine just did. Newest first, so the newest goes first. */
  record(actor: UserDto, event: AuditEvent): Promise<void> {
    this.filed.unshift({
      resourceKey: event.resourceKey,
      recordPk: event.recordId === null ? null : String(event.recordId),
      event: {
        id: randomUUID(),
        kind: event.kind,
        actionKey: event.actionKey,
        actorEmail: actor.email,
        outcome: event.outcome,
        reason: event.reason,
        before: event.before,
        after: event.after,
        at: new Date().toISOString(),
      },
    });

    return Promise.resolve();
  }

  /** A page of one record's own history. */
  forRecord(resourceKey: string, id: RecordId, query: ActivityQuery): ActivityListDto {
    const recordPk = String(id);
    const found = this.filed.filter(
      (entry) => entry.resourceKey === resourceKey && entry.recordPk === recordPk,
    );

    const from = (query.page - 1) * query.pageSize;

    return {
      events: found.slice(from, from + query.pageSize).map((entry) => entry.event),
      total: found.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
