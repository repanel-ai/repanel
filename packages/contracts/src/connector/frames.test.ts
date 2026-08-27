import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLOUD_FRAMES,
  CONNECTOR_FRAMES,
  DESCRIPTOR_KINDS,
  cloudFrameSchema,
  connectorFrameSchema,
  descriptorSchema,
  type Descriptor,
} from "./frames.js";

/**
 * The gate this file exists for: what Cloud may send a connector is a closed
 * set, and every member of it is addressing rather than instruction. A frame
 * carrying SQL is not a request that gets rejected at runtime — there is no
 * member of the union it could be written as, so it does not typecheck and does
 * not parse. These tests are the executable half of that claim; the type half
 * is the union itself.
 */

/** The kinds the union actually declares, read out of the schema. */
function declaredKinds(): string[] {
  return descriptorSchema.options.map((option) => option.shape.kind.value as string);
}

test("the descriptor union is exactly the seven engine entry points", () => {
  assert.deepEqual(declaredKinds().sort(), [...DESCRIPTOR_KINDS].sort());
});

test("every descriptor kind is reachable from the type", () => {
  // The compiler checks this exhaustively: adding a member to the schema
  // without adding it here stops being a passing test the moment it stops
  // being an exhaustive switch.
  const label = (descriptor: Descriptor): string => {
    switch (descriptor.kind) {
      case "listRecords":
      case "getRecord":
      case "listOptions":
      case "listRelated":
      case "createRecord":
      case "updateRecord":
      case "runAction":
        return descriptor.kind;
      default: {
        const unreachable: never = descriptor;
        return unreachable;
      }
    }
  };

  assert.equal(label({ kind: "runAction", resourceKey: "orders", id: 7, actionKey: "refund" }), "runAction");
});

test("no descriptor accepts a field nobody declared", () => {
  for (const kind of DESCRIPTOR_KINDS) {
    const smuggled = descriptorSchema.safeParse({
      kind,
      resourceKey: "orders",
      id: 1,
      relationshipKey: "items",
      actionKey: "refund",
      query: {},
      write: { values: {} },
      sql: "select * from orders",
    });
    assert.equal(smuggled.success, false, `${kind} accepted a frame carrying SQL`);
  }
});

test("a resource key is an identifier, so it can never be a statement", () => {
  const injected = descriptorSchema.safeParse({
    kind: "listRecords",
    resourceKey: "orders; drop table orders",
    query: {},
  });
  assert.equal(injected.success, false);
});

test("a descriptor's query is the runtime's own, defaults and all", () => {
  const parsed = descriptorSchema.parse({ kind: "listRecords", resourceKey: "orders", query: {} });
  assert.deepEqual(parsed, { kind: "listRecords", resourceKey: "orders", query: { page: 1, pageSize: 25 } });
});

test("a page size beyond the runtime's ceiling is refused on the wire too", () => {
  const parsed = descriptorSchema.safeParse({
    kind: "listRecords",
    resourceKey: "orders",
    query: { page: 1, pageSize: 5000 },
  });
  assert.equal(parsed.success, false);
});

test("the two frame unions are closed", () => {
  const cloud = cloudFrameSchema.options.map((option) => option.shape.frame.value as string);
  const connector = connectorFrameSchema.options.map((option) => option.shape.frame.value as string);

  assert.deepEqual([...new Set(cloud)].sort(), [...CLOUD_FRAMES].sort());
  assert.deepEqual([...new Set(connector)].sort(), [...CONNECTOR_FRAMES].sort());
  assert.equal(cloudFrameSchema.safeParse({ frame: "runSql", text: "select 1" }).success, false);
  assert.equal(connectorFrameSchema.safeParse({ frame: "log", text: "hello" }).success, false);
});

test("an execute frame carries a descriptor and the version it was resolved against", () => {
  const frame = cloudFrameSchema.parse({
    frame: "execute",
    id: 4,
    definitionVersion: 12,
    descriptor: { kind: "getRecord", resourceKey: "orders", id: "abc" },
  });

  assert.deepEqual(frame, {
    frame: "execute",
    id: 4,
    definitionVersion: 12,
    descriptor: { kind: "getRecord", resourceKey: "orders", id: "abc" },
  });
});

test("a result frame with no audit trail reads as an empty one", () => {
  const frame = connectorFrameSchema.parse({
    frame: "result",
    id: 1,
    outcome: { ok: true, result: { records: [] } },
  });
  assert.deepEqual(frame.frame === "result" && frame.audit, []);
});

test("a refused write brings its audit trail back with it", () => {
  const frame = connectorFrameSchema.parse({
    frame: "result",
    id: 2,
    outcome: {
      ok: false,
      error: {
        code: "validation_failed",
        message: "no",
        details: [{ path: "values.name", message: "m", expected: "e", hint: "h" }],
      },
    },
    audit: [
      {
        kind: "update",
        resourceKey: "orders",
        recordId: 3,
        actionKey: null,
        outcome: "refused",
        reason: "validation_failed",
        before: null,
        after: null,
      },
    ],
  });

  assert.equal(frame.frame === "result" && frame.audit.length, 1);
});
