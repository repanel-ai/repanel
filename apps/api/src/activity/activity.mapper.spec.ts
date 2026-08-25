import type { AuditEventRow } from "./activity.repository";
import { toActivityEvent } from "./activity.mapper";

function row(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: "6f1a1b2c-1111-4111-8111-aaaaaaaaaaaa",
    projectId: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
    actorUserId: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
    actorEmail: "ada@acme.test",
    resourceKey: "airlines",
    recordPk: "air-1",
    kind: "action",
    actionKey: "approve",
    before: { approval_status: "pending" },
    after: { approval_status: "approved" },
    outcome: "ok",
    reason: null,
    at: new Date("2026-08-26T02:16:00.000Z"),
    ...overrides,
  };
}

describe("toActivityEvent", () => {
  it("says who did what, when, and to what it did it", () => {
    expect(toActivityEvent(row())).toEqual({
      id: "6f1a1b2c-1111-4111-8111-aaaaaaaaaaaa",
      kind: "action",
      actionKey: "approve",
      actorEmail: "ada@acme.test",
      outcome: "ok",
      reason: null,
      before: { approval_status: "pending" },
      after: { approval_status: "approved" },
      at: "2026-08-26T02:16:00.000Z",
    });
  });

  /**
   * The project and the actor's user id are ours. What goes out is the address,
   * because that is who a second operator reading this recognises — an internal
   * id would name the same person and tell nobody which one.
   */
  it("leaves the project and the actor's id behind", () => {
    const event = toActivityEvent(row());

    expect(event).not.toHaveProperty("projectId");
    expect(event).not.toHaveProperty("actorUserId");
    expect(JSON.stringify(event)).not.toContain("8c9a3f70");
  });

  it("carries the category of a refusal out with it", () => {
    const event = toActivityEvent(
      row({ outcome: "refused", reason: "action_rejected", before: null, after: null }),
    );

    expect(event).toMatchObject({ outcome: "refused", reason: "action_rejected" });
    expect(event.before).toBeNull();
  });

  /** A row outlives the process, so no `Date` follows it onto the wire. */
  it("writes the moment as text", () => {
    expect(toActivityEvent(row()).at).toBe("2026-08-26T02:16:00.000Z");
  });
});
