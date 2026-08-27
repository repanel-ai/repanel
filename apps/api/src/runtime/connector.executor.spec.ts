import type { Descriptor, FrameAuditEvent } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { validateDefinition } from "@repanel/contracts";
import { CALL_TIMEOUT_MS, STATEMENT_TIMEOUT_MS, indexResources, type AuditEvent } from "@repanel/engine";
import type { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import { ConflictError, NotFoundError, ValidationFailedError } from "../errors/domain-errors";
import {
  ACTION_TIMEOUT_MS,
  ConnectorExecutor,
  READ_TIMEOUT_MS,
} from "./connector.executor";
import { FILES_NOTHING, SIGNS_NOTHING, type ServingContext } from "./runtime-executor";

const PROJECT = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const definition = (() => {
  const result = validateDefinition(saasDefinition);
  if (!result.valid) throw new Error("the fixture is not valid");
  return result.definition;
})();

const OK_EVENT: FrameAuditEvent = {
  kind: "update",
  resourceKey: "users",
  recordId: "u1",
  actionKey: null,
  outcome: "ok",
  reason: null,
  before: { name: "Bob" },
  after: { name: "Bobby" },
};

/** What the far end was asked, and what it was told to answer with. */
class ScriptedChannel {
  readonly asked: Array<{ descriptor: Descriptor; timeoutMs: number; definitionVersion: number }> = [];
  outcome: { ok: true; result: unknown } | { ok: false; error: { code: string; message: string; details?: unknown[] } } = {
    ok: true,
    result: { ok: true },
  };
  audit: FrameAuditEvent[] = [];

  execute(_projectId: string, definitionVersion: number, descriptor: Descriptor, timeoutMs: number) {
    this.asked.push({ descriptor, timeoutMs, definitionVersion });
    return Promise.resolve({ outcome: this.outcome, audit: this.audit });
  }
}

function executorOn(channel: ScriptedChannel, audit = FILES_NOTHING): {
  executor: ConnectorExecutor;
  filed: AuditEvent[];
} {
  const filed: AuditEvent[] = [];
  const collecting =
    audit === FILES_NOTHING
      ? FILES_NOTHING
      : (event: AuditEvent) => {
          filed.push(event);
          return audit(event);
        };

  const context: ServingContext = {
    projectId: PROJECT,
    definition,
    definitionVersion: 4,
    resources: indexResources(definition),
    connectionKind: () => Promise.resolve("connector"),
    pool: () => Promise.reject(new Error("the connector rung opens no pool here")),
    audit: collecting,
    secret: SIGNS_NOTHING,
  };

  return {
    executor: new ConnectorExecutor(channel as unknown as ConnectorSocketsService, context),
    filed,
  };
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("ConnectorExecutor", () => {
  describe("the deadlines it gives the hop", () => {
    it("waits longer than the statement does, so a slow query answers as one", () => {
      expect(READ_TIMEOUT_MS).toBeGreaterThan(STATEMENT_TIMEOUT_MS);
    });

    it("gives an action room for the call inside it as well", () => {
      expect(ACTION_TIMEOUT_MS).toBeGreaterThan(READ_TIMEOUT_MS);
      expect(ACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(STATEMENT_TIMEOUT_MS + CALL_TIMEOUT_MS);
    });

    it("uses the read deadline for a read and the action deadline for an action", async () => {
      const channel = new ScriptedChannel();
      const { executor } = executorOn(channel);

      await executor.listRecords("users", { page: 1, pageSize: 25 });
      channel.outcome = { ok: true, result: { ok: true, label: "Suspend" } };
      await executor.runAction("users", "u1", "suspend");

      expect(channel.asked.map((asked) => asked.timeoutMs)).toEqual([READ_TIMEOUT_MS, ACTION_TIMEOUT_MS]);
    });
  });

  describe("what it sends", () => {
    it("addresses each request as the descriptor for it, with the version it resolved", async () => {
      const channel = new ScriptedChannel();
      const { executor } = executorOn(channel);

      await executor.listRelated("users", "u1", "orders", { page: 2, pageSize: 10 });

      expect(channel.asked[0]).toMatchObject({
        definitionVersion: 4,
        descriptor: {
          kind: "listRelated",
          resourceKey: "users",
          id: "u1",
          relationshipKey: "orders",
          query: { page: 2, pageSize: 10 },
        },
      });
    });

    it("answers a resource this admin does not have without sending anything", async () => {
      const channel = new ScriptedChannel();
      const { executor } = executorOn(channel);

      const refusal = await refusalFrom(executor.getRecord("nope", "u1"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(channel.asked).toEqual([]);
    });
  });

  describe("what it does with a refusal", () => {
    it("rebuilds the engine's own error, so both rungs answer alike", async () => {
      const channel = new ScriptedChannel();
      channel.outcome = { ok: false, error: { code: "conflict", message: "already there" } };
      const { executor } = executorOn(channel);

      const refusal = await refusalFrom(executor.getRecord("users", "u1"));

      expect(refusal).toBeInstanceOf(ConflictError);
      expect(refusal.message).toBe("already there");
    });

    it("carries a form's details home, because the renderer puts them under fields", async () => {
      const channel = new ScriptedChannel();
      channel.outcome = {
        ok: false,
        error: {
          code: "validation_failed",
          message: "This record could not be saved.",
          details: [{ path: "values.email", message: "no", expected: "an email", hint: "fix it" }],
        },
      };
      const { executor } = executorOn(channel);

      const refusal = await refusalFrom(executor.updateRecord("users", "u1", { values: {} }));

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect((refusal as ValidationFailedError).details[0]?.path).toBe("values.email");
    });

    it("does not invent a status for a code this build does not know", async () => {
      const channel = new ScriptedChannel();
      channel.outcome = { ok: false, error: { code: "from_the_future", message: "?" } };
      const { executor } = executorOn(channel);

      const refusal = await refusalFrom(executor.getRecord("users", "u1"));

      expect(refusal).not.toBeInstanceOf(NotFoundError);
      expect(refusal.message).toContain("from_the_future");
    });
  });

  describe("what it does with the audit that comes back", () => {
    it("files a write's event before the caller is told the write succeeded", async () => {
      const channel = new ScriptedChannel();
      channel.audit = [OK_EVENT];
      const order: string[] = [];
      const { executor } = executorOn(channel, (event: AuditEvent) => {
        order.push(`filed ${event.outcome}`);
        return Promise.resolve();
      });

      await executor.updateRecord("users", "u1", { values: { name: "Bobby" } });
      order.push("answered");

      expect(order).toEqual(["filed ok", "answered"]);
    });

    it("fails a write whose event could not be filed, rather than reporting a clean success", async () => {
      const channel = new ScriptedChannel();
      channel.audit = [OK_EVENT];
      const { executor } = executorOn(channel, () => Promise.reject(new Error("the log is down")));

      const refusal = await refusalFrom(executor.createRecord("users", { values: { email: "a@b.c" } }));

      expect(refusal.message).toBe("the log is down");
    });

    it("does not turn an httpCall that already landed into a failure the log caused", async () => {
      const channel = new ScriptedChannel();
      channel.outcome = { ok: true, result: { ok: true, label: "Resend invite" } };
      channel.audit = [{ ...OK_EVENT, kind: "action", actionKey: "resend_invite" }];
      const { executor } = executorOn(channel, () => Promise.reject(new Error("the log is down")));

      // The effect is inside the customer's application and cannot be taken
      // back, so the operator is told what actually happened (DECISIONS #061).
      await expect(executor.runAction("users", "u1", "resend_invite")).resolves.toEqual({
        ok: true,
        label: "Resend invite",
      });
    });

    it("files a refusal's events best-effort, so the log never replaces the real answer", async () => {
      const channel = new ScriptedChannel();
      channel.outcome = { ok: false, error: { code: "conflict", message: "already there" } };
      channel.audit = [{ ...OK_EVENT, outcome: "refused", reason: "conflict" }];
      const { executor } = executorOn(channel, () => Promise.reject(new Error("the log is down")));

      const refusal = await refusalFrom(executor.updateRecord("users", "u1", { values: {} }));

      expect(refusal).toBeInstanceOf(ConflictError);
    });

    it("files nothing for a read, because a read does nothing to file", async () => {
      const channel = new ScriptedChannel();
      const { executor, filed } = executorOn(channel, () => Promise.resolve());

      await executor.listRecords("users", { page: 1, pageSize: 25 });

      expect(filed).toEqual([]);
    });
  });
});
