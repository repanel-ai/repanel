import type { ActivityEventDto, AuditValues } from "@repanel/contracts";
import type { AuditEventRow } from "./activity.repository";

/**
 * The only way an audit row leaves the API.
 *
 * The project it belongs to and the actor's user id stay behind. The address
 * goes, because that is who a second operator reading this needs to recognise;
 * an internal id would name the same person and tell nobody which one.
 */
export function toActivityEvent(event: AuditEventRow): ActivityEventDto {
  return {
    id: event.id,
    kind: event.kind,
    actionKey: event.actionKey,
    actorEmail: event.actorEmail,
    outcome: event.outcome,
    reason: event.reason,
    before: event.before as AuditValues | null,
    after: event.after as AuditValues | null,
    at: event.at.toISOString(),
  };
}
