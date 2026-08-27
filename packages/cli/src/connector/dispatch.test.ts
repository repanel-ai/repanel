import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDefinition, type Definition, type Descriptor } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import {
  ConflictError,
  NotFoundError,
  ValidationFailedError,
  type ActionRunner,
  type RecordReader,
  type RecordWriter,
} from "@repanel/engine";
import type { Pool } from "pg";
import { frameErrorOf, serve, type ConnectorEngine } from "./dispatch.js";

const definition: Definition = (() => {
  const result = validateDefinition(saasDefinition);
  if (!result.valid) throw new Error("the fixture is not valid");
  return result.definition;
})();

/** What the engine was asked to do, without doing any of it. */
function recordingEngine(answer: unknown = "answered"): {
  engine: ConnectorEngine;
  calls: Array<[string, unknown[]]>;
} {
  const calls: Array<[string, unknown[]]> = [];
  const note =
    (name: string) =>
    (...args: unknown[]): Promise<unknown> => {
      calls.push([name, args.slice(1)]);
      return Promise.resolve(answer);
    };

  return {
    calls,
    engine: {
      reader: {
        listRecords: note("listRecords"),
        getRecord: note("getRecord"),
        listOptions: note("listOptions"),
        listRelated: note("listRelated"),
      } as unknown as RecordReader,
      writer: {
        createRecord: note("createRecord"),
        updateRecord: note("updateRecord"),
      } as unknown as RecordWriter,
      runner: { run: note("runAction") } as unknown as ActionRunner,
    },
  };
}

function options(engine: ConnectorEngine) {
  return {
    engine,
    definition,
    pool: () => Promise.reject(new Error("no database in this test")) as Promise<Pool>,
    secret: () => Promise.resolve("s3cret"),
  };
}

const PAGE = { page: 1, pageSize: 25 };

/** Every descriptor there is, and the engine call each one is. */
const ROUTES: Array<[Descriptor, string, unknown[]]> = [
  [{ kind: "listRecords", resourceKey: "users", query: PAGE }, "listRecords", ["users", PAGE]],
  [{ kind: "getRecord", resourceKey: "users", id: "u1" }, "getRecord", ["users", "u1"]],
  [{ kind: "listOptions", resourceKey: "users", query: {} }, "listOptions", ["users", {}]],
  [
    { kind: "listRelated", resourceKey: "users", id: "u1", relationshipKey: "orders", query: PAGE },
    "listRelated",
    ["users", "u1", "orders", PAGE],
  ],
  [
    { kind: "createRecord", resourceKey: "users", write: { values: { email: "a@b.c" } } },
    "createRecord",
    ["users", { values: { email: "a@b.c" } }],
  ],
  [
    { kind: "updateRecord", resourceKey: "users", id: "u1", write: { values: { name: "Bo" } } },
    "updateRecord",
    ["users", "u1", { values: { name: "Bo" } }],
  ],
  [
    { kind: "runAction", resourceKey: "users", id: "u1", actionKey: "suspend" },
    "runAction",
    ["users", "u1", "suspend"],
  ],
];

for (const [descriptor, method, args] of ROUTES) {
  test(`a ${descriptor.kind} descriptor is the engine's ${method}, and nothing else`, async () => {
    const { engine, calls } = recordingEngine();

    const served = await serve(options(engine), descriptor);

    assert.deepEqual(calls, [[method, args]]);
    assert.deepEqual(served, { ok: true, result: "answered", audit: [] });
  });
}

test("the engine's account of a write travels back with the answer", async () => {
  const event = {
    kind: "update" as const,
    resourceKey: "users",
    recordId: "u1",
    actionKey: null,
    outcome: "ok" as const,
    reason: null,
    before: { name: "Bob" },
    after: { name: "Bobby" },
  };
  const engine: ConnectorEngine = {
    reader: {} as unknown as RecordReader,
    writer: {
      updateRecord: (context: { audit: (event: unknown) => Promise<void> }) =>
        context.audit(event).then(() => "written"),
    } as unknown as RecordWriter,
    runner: {} as unknown as ActionRunner,
  };

  const served = await serve(options(engine), {
    kind: "updateRecord",
    resourceKey: "users",
    id: "u1",
    write: { values: { name: "Bobby" } },
  });

  assert.deepEqual(served, { ok: true, result: "written", audit: [event] });
});

test("a refusal comes back as its code, with whatever the engine filed before it", async () => {
  const engine: ConnectorEngine = {
    reader: {} as unknown as RecordReader,
    writer: {
      createRecord: () => Promise.reject(new ConflictError("that email is taken")),
    } as unknown as RecordWriter,
    runner: {} as unknown as ActionRunner,
  };

  const served = await serve(options(engine), {
    kind: "createRecord",
    resourceKey: "users",
    write: { values: { email: "a@b.c" } },
  });

  assert.deepEqual(served, {
    ok: false,
    error: { code: "conflict", message: "that email is taken" },
    audit: [],
  });
});

test("the secret an action signs with is the one the session was opened with", async () => {
  let seen = "";
  const engine: ConnectorEngine = {
    reader: {} as unknown as RecordReader,
    writer: {} as unknown as RecordWriter,
    runner: {
      run: async (context: { secret: () => Promise<string> }) => {
        seen = await context.secret();
        return { ok: true, label: "Resend invite" };
      },
    } as unknown as ActionRunner,
  };

  await serve(options(engine), {
    kind: "runAction",
    resourceKey: "users",
    id: "u1",
    actionKey: "resend_invite",
  });

  assert.equal(seen, "s3cret");
});

test("a form's refusal keeps the paths the renderer puts its sentences under", () => {
  const details = [{ path: "values.email", message: "no", expected: "an email", hint: "fix it" }];

  assert.deepEqual(frameErrorOf(new ValidationFailedError("This record could not be saved.", details)), {
    code: "validation_failed",
    message: "This record could not be saved.",
    details,
  });
});

test("a domain error crosses as its code and its message, which is all a caller is owed", () => {
  assert.deepEqual(frameErrorOf(new NotFoundError("Record not found")), {
    code: "not_found",
    message: "Record not found",
  });
});

test("anything else crosses as an internal failure carrying none of itself", () => {
  const failure = frameErrorOf(new Error("ECONNREFUSED 10.0.0.4:5432 while opening the pool"));

  assert.deepEqual(failure, {
    code: "internal_error",
    message: "The connector could not serve this request.",
  });
  assert.ok(!JSON.stringify(failure).includes("10.0.0.4"));
});
