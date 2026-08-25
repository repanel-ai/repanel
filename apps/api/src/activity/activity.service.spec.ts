import type { ProjectDto, UserDto } from "@repanel/contracts";
import type { AuditEvent } from "@repanel/engine";
import { NotFoundError } from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { ActivityService } from "./activity.service";
import type { AuditEventRow, ActivityRepository } from "./activity.repository";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

const OPERATOR: UserDto = {
  id: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
  email: "ada@acme.test",
  name: "Ada",
};

const APPROVED: AuditEvent = {
  kind: "action",
  resourceKey: "airlines",
  recordId: "air-1",
  actionKey: "approve",
  outcome: "ok",
  reason: null,
  before: { approval_status: "pending" },
  after: { approval_status: "approved" },
};

function row(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: "6f1a1b2c-1111-4111-8111-aaaaaaaaaaaa",
    projectId: PROJECT.id,
    actorUserId: OPERATOR.id,
    actorEmail: OPERATOR.email,
    resourceKey: "airlines",
    recordPk: "air-1",
    kind: "action",
    actionKey: "approve",
    before: null,
    after: null,
    outcome: "ok",
    reason: null,
    at: new Date("2026-08-26T02:16:00.000Z"),
    ...overrides,
  };
}

describe("ActivityService", () => {
  let projects: { requireOwnedByKey: jest.Mock };
  let repository: { insert: jest.Mock; listForRecord: jest.Mock };
  let activity: ActivityService;

  beforeEach(() => {
    projects = { requireOwnedByKey: jest.fn().mockResolvedValue(PROJECT) };
    repository = {
      insert: jest.fn().mockResolvedValue(row()),
      listForRecord: jest.fn().mockResolvedValue({ rows: [row()], total: 1 }),
    };
    activity = new ActivityService(
      projects as unknown as ProjectsService,
      repository as unknown as ActivityRepository,
    );
  });

  describe("filing an event", () => {
    it("puts the operator and the project beside what the engine reported", async () => {
      await activity.record(OPERATOR, PROJECT.id, APPROVED);

      expect(repository.insert).toHaveBeenCalledWith({
        projectId: PROJECT.id,
        actorUserId: OPERATOR.id,
        actorEmail: OPERATOR.email,
        resourceKey: "airlines",
        recordPk: "air-1",
        kind: "action",
        actionKey: "approve",
        before: { approval_status: "pending" },
        after: { approval_status: "approved" },
        outcome: "ok",
        reason: null,
      });
    });

    /**
     * A customer's key is a uuid, a slug or a number, and the one thing all
     * three survive being written as is their own characters.
     */
    it("writes a numeric key as the characters the runtime addresses it by", async () => {
      await activity.record(OPERATOR, PROJECT.id, { ...APPROVED, recordId: 1042 });

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ recordPk: "1042" }),
      );
    });

    it("files a create that never got a key with no key", async () => {
      await activity.record(OPERATOR, PROJECT.id, {
        ...APPROVED,
        kind: "create",
        actionKey: null,
        recordId: null,
      });

      expect(repository.insert).toHaveBeenCalledWith(expect.objectContaining({ recordPk: null }));
    });

    /**
     * The caller was authorized before the write this is accounting for, so
     * there is nothing left to decide — and a check that could refuse here
     * would be a check that could leave a write unrecorded.
     */
    it("asks nobody's permission to file what has already happened", async () => {
      await activity.record(OPERATOR, PROJECT.id, APPROVED);

      expect(projects.requireOwnedByKey).not.toHaveBeenCalled();
    });

    it("does not swallow a log that could not be written", async () => {
      repository.insert.mockRejectedValue(new Error("the log is down"));

      await expect(activity.record(OPERATOR, PROJECT.id, APPROVED)).rejects.toThrow("the log is down");
    });
  });

  describe("reading a record's history", () => {
    it("answers with the page, mapped, and the count that says how many there are", async () => {
      const page = await activity.listForRecord(OPERATOR.id, PROJECT.key, "airlines", "air-1", {
        page: 1,
        pageSize: 5,
      });

      expect(page).toEqual({
        events: [expect.objectContaining({ actorEmail: OPERATOR.email, actionKey: "approve" })],
        total: 1,
        page: 1,
        pageSize: 5,
      });
      expect(repository.listForRecord).toHaveBeenCalledWith(PROJECT.id, "airlines", "air-1", 1, 5);
    });

    /** Someone else's project reads as missing, exactly as every other read. */
    it("asks whether this owner has the project before anything else", async () => {
      projects.requireOwnedByKey.mockRejectedValue(new NotFoundError("Project not found"));

      await expect(
        activity.listForRecord(OPERATOR.id, PROJECT.key, "airlines", "air-1", { page: 1, pageSize: 5 }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repository.listForRecord).not.toHaveBeenCalled();
    });

    /**
     * A resource key and a primary key are the customer's own vocabulary, and
     * two projects are entitled to share them — so the project narrows the read
     * as well as authorizing it.
     */
    it("narrows the read to the project it authorized", async () => {
      await activity.listForRecord(OPERATOR.id, PROJECT.key, "airlines", 1042, {
        page: 3,
        pageSize: 10,
      });

      expect(repository.listForRecord).toHaveBeenCalledWith(PROJECT.id, "airlines", "1042", 3, 10);
    });
  });
});
