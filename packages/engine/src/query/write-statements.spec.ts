import {
  validateDefinition,
  type Definition,
  type DefinitionInput,
  type Field,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { UnservableResourceError, ValidationFailedError } from "../errors.js";
import { prismaDefinition } from "../fixtures/mixed-case.js";
import { insertStatement, updateStatement, type Assignment } from "./write-statements.js";

function definitionFrom(
  input: DefinitionInput,
  mutate: (draft: DefinitionInput) => void = () => {},
): Definition {
  const draft = structuredClone(input);
  mutate(draft);
  const result = validateDefinition(draft);
  if (!result.valid) {
    throw new Error(`the fixture is not valid:\n${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.definition;
}

function resourcesOf(definition: Definition): ReadonlyMap<string, Resource> {
  return new Map(definition.resources.map((resource) => [resource.key, resource]));
}

function resourceOf(definition: Definition, key: string): Resource {
  const resource = definition.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
}

function fieldOf(resource: Resource, key: string): Field {
  const field = resource.fields.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`the fixture's \`${resource.key}\` has no field \`${key}\``);
  return field;
}

function set(resource: Resource, values: Record<string, unknown>): Assignment[] {
  return Object.entries(values).map(([key, value]) => ({
    field: fieldOf(resource, key),
    value: value as Assignment["value"],
  }));
}

/**
 * A resource with a field changed after validation ran — the shape a definition
 * stored before a rule existed has, and the only way to put a value in front of
 * the builder that the validator would have stopped.
 */
function smuggle(resource: Resource, key: string, change: Partial<Field>): Resource {
  return {
    ...resource,
    fields: resource.fields.map((field) =>
      field.key === key ? ({ ...field, ...change } as Field) : field,
    ),
  };
}

function refusalFrom(build: () => unknown): Error {
  try {
    build();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the write builder to refuse");
}

const SAAS = definitionFrom(saasDefinition);
const RESOURCES = resourcesOf(SAAS);
const USERS = resourceOf(SAAS, "users");
const ORDERS = resourceOf(SAAS, "orders");

/**
 * The same admin over a `users` table whose keys are chosen rather than
 * generated — the one shape in which a primary key reaches a statement.
 */
const KEYED = definitionFrom(saasDefinition, (draft) => {
  const users = draft.resources.find((resource) => resource.key === "users");
  if (!users) throw new Error("the fixture has no `users`");
  users.primaryKeyGeneration = "client";
  const id = users.fields.find((field) => field.key === "id");
  if (!id) throw new Error("`users` has no `id`");
  id.editable = true;
  id.required = true;
});
const KEYED_RESOURCES = resourcesOf(KEYED);
const KEYED_USERS = resourceOf(KEYED, "users");

/** Every non-sensitive column of `users`, which is what a write hands back. */
const USERS_RETURNING =
  '"id", "email", "name", "status", "organization_id", "is_active", "notes", ' +
  '"created_at", "avatar_url", "trial_ends_on", "login_count", "preferences"';

const USERS_SELECT =
  '"t"."id" as "c0", "t"."email" as "c1", "t"."name" as "c2", "t"."status" as "c3", ' +
  '"t"."organization_id" as "c4", "j0"."name" as "c5", "t"."is_active" as "c6", ' +
  '"t"."notes" as "c7", "t"."created_at" as "c8", "t"."avatar_url" as "c9", ' +
  '"t"."trial_ends_on" as "c10", "t"."login_count" as "c11", "t"."preferences" as "c12"';

const USERS_FROM =
  'from "w" as "t" left join "organizations" as "j0" on "j0"."id" = "t"."organization_id"';

describe("insertStatement", () => {
  it("writes the row and reads it back in one statement", () => {
    const query = insertStatement(
      RESOURCES,
      USERS,
      set(USERS, { email: "ada@example.test", name: "Ada", organization_id: "org_1" }),
    );

    expect(query.text).toBe(
      `with "w" as (insert into "users" ("email", "name", "organization_id")` +
        ` values ($1, $2, $3) returning ${USERS_RETURNING})` +
        ` select ${USERS_SELECT} ${USERS_FROM}`,
    );
    expect(query.values).toEqual(["ada@example.test", "Ada", "org_1"]);
  });

  it("binds every value, whatever its type", () => {
    const query = insertStatement(
      RESOURCES,
      USERS,
      set(USERS, {
        email: "ada@example.test",
        name: "Ada",
        login_count: 3,
        notes: null,
        trial_ends_on: "2026-12-31",
      }),
    );

    expect(query.text).toContain('values ($1, $2, $3, $4, $5)');
    expect(query.values).toEqual(["ada@example.test", "Ada", 3, null, "2026-12-31"]);
  });

  it("leaves the key column out where the database issues it", () => {
    const query = insertStatement(RESOURCES, USERS, set(USERS, { email: "a@b.test", name: "Ada" }));

    expect(query.text).toContain('insert into "users" ("email", "name") values ($1, $2)');
    // Out of the insert, and still in what the statement hands back: the key
    // the database issued is how the written record is answered for.
    expect(query.text).toContain(`returning ${USERS_RETURNING}`);
  });

  it("writes the key column where the resource says the client issues it", () => {
    const query = insertStatement(
      KEYED_RESOURCES,
      KEYED_USERS,
      set(KEYED_USERS, { id: "u_ada", email: "a@b.test", name: "Ada" }),
    );

    expect(query.text).toContain('insert into "users" ("id", "email", "name") values ($1, $2, $3)');
    expect(query.values).toEqual(["u_ada", "a@b.test", "Ada"]);
  });

  it("quotes every identifier, so a mixed-case schema is writable", () => {
    const prisma = definitionFrom(prismaDefinition, (draft) => {
      const user = draft.resources[0];
      if (!user) throw new Error("the fixture has no `User`");
      user.writes = { create: true, update: true };
      const avatar = user.fields.find((field) => field.key === "avatarUrl");
      if (avatar) avatar.editable = true;
    });
    const user = resourceOf(prisma, "User");

    const query = insertStatement(resourcesOf(prisma), user, [
      { field: fieldOf(user, "avatarUrl"), value: "https://x.test/a.png" },
    ]);

    expect(query.text).toContain('insert into "User" ("avatarUrl") values ($1)');
    expect(query.text).toContain('returning "id", "email", "avatarUrl", "teamId"');
  });
});

describe("updateStatement", () => {
  it("sets the fields it was given and reads the record back", () => {
    const query = updateStatement(RESOURCES, ORDERS, set(ORDERS, { reference: "AC-2" }), "ord_1");

    expect(query.text).toBe(
      'with "b" as (select "t"."reference" as "b0" from "orders" as "t" where "t"."id" = $2),' +
        ' "w" as (update "orders" set "reference" = $1 where "id" = $2' +
        ' returning "id", "reference", "user_id", "status", "total_cents", "metadata", "placed_at")' +
        ' select "t"."id" as "c0", "t"."reference" as "c1", "t"."user_id" as "c2", "j0"."email" as "c3",' +
        ' "t"."status" as "c4", "t"."total_cents" as "c5", "t"."metadata" as "c6", "t"."placed_at" as "c7",' +
        ' "b"."b0" as "b0"' +
        ' from "w" as "t" left join "users" as "j0" on "j0"."id" = "t"."user_id" cross join "b"',
    );
    expect(query.values).toEqual(["AC-2", "ord_1"]);
  });

  it("binds the id last, after every value it sets", () => {
    const query = updateStatement(
      RESOURCES,
      USERS,
      set(USERS, { name: "Ada", notes: "hello" }),
      "user-9",
    );

    expect(query.text).toContain('set "name" = $1, "notes" = $2 where "id" = $3');
    expect(query.values).toEqual(["Ada", "hello", "user-9"]);
  });
});

/**
 * What the update replaced, read beside it rather than before it. The two
 * halves are one statement, so they are one snapshot — there is no round trip
 * between them for another write to land in (DECISIONS #056, #061).
 */
describe("what an update replaced", () => {
  it("reads the columns it is about to set, in the resource's own order", () => {
    const query = updateStatement(
      RESOURCES,
      USERS,
      set(USERS, { name: "Ada", notes: "hello" }),
      "user-9",
    );

    expect(query.text).toContain(
      'with "b" as (select "t"."name" as "b0", "t"."notes" as "b1" from "users" as "t"',
    );
    expect(query.before?.map((entry) => entry.key)).toEqual(["name", "notes"]);
  });

  /**
   * A statement that read the whole row to file two of its columns would be
   * selecting a customer's data in order to throw it away — and every column it
   * did not need is a column an audit record could leak.
   */
  it("reads no column the write did not name", () => {
    const query = updateStatement(RESOURCES, USERS, set(USERS, { name: "Ada" }), "user-1");
    const before = /with "b" as \(([^)]+)\)/.exec(query.text)?.[1] ?? "";

    expect(query.before?.map((entry) => entry.key)).toEqual(["name"]);
    expect(before).not.toContain("password_hash");
    expect(before).not.toContain("email");
  });

  it("points both halves at the same row with the same placeholder", () => {
    const query = updateStatement(RESOURCES, USERS, set(USERS, { name: "Ada" }), "user-1");

    expect(query.text).toContain('where "t"."id" = $2');
    expect(query.text).toContain('where "id" = $2 returning');
    expect(query.values).toEqual(["Ada", "user-1"]);
  });

  /** A record being made replaced nothing, so there is nothing to have read. */
  it("is absent from an insert", () => {
    const query = insertStatement(RESOURCES, USERS, set(USERS, { email: "a@b.test", name: "Ada" }));

    expect(query.before).toBeUndefined();
    expect(query.text.startsWith('with "w" as (insert')).toBe(true);
  });
});

describe("what a write hands back", () => {
  it("never returns a sensitive column, into the statement or out of it", () => {
    const query = updateStatement(RESOURCES, USERS, set(USERS, { name: "Ada" }), "user-1");

    expect(query.text).not.toContain("password_hash");
    expect(query.select.some((entry) => entry.key === "password_hash")).toBe(false);
  });

  /** `hidden` is detail-only, and what a form answers with is a detail payload. */
  it("returns a hidden column, because a written record is read like a detail", () => {
    const query = updateStatement(RESOURCES, USERS, set(USERS, { name: "Ada" }), "user-1");

    expect(query.text).toContain('"preferences"');
    expect(query.select.some((entry) => entry.key === "preferences")).toBe(true);
  });

  it("selects only columns the statement returned, so the two cannot drift", () => {
    const query = insertStatement(RESOURCES, USERS, set(USERS, { email: "a@b.test", name: "Ada" }));
    const returned = new Set(
      (/returning ([^)]+)\)/.exec(query.text)?.[1] ?? "").split(", ").map((name) => name.slice(1, -1)),
    );

    for (const entry of query.select) {
      if (entry.kind === "value") expect(returned.has(entry.key)).toBe(true);
    }
  });

  it("reads a relation's label off the same join a detail read would have made", () => {
    const query = insertStatement(RESOURCES, USERS, set(USERS, { email: "a@b.test", name: "Ada" }));
    const label = query.select.find((entry) => entry.kind === "label");

    expect(label?.key).toBe("organization_id");
    expect(label?.field.key).toBe("name");
  });
});

describe("the wall at the statement", () => {
  /**
   * Each of these is a definition validation refuses to accept. They are put in
   * front of the builder anyway, because a definition stored before the rule
   * existed is exactly this shape — and because a guard that is only ever
   * reached through a validator is a guard nothing has tested.
   */
  it("refuses to write a sensitive column, with a path the form can use", () => {
    const stored = smuggle(USERS, "password_hash", { editable: true });

    const refusal = refusalFrom(() =>
      insertStatement(RESOURCES, stored, [
        { field: fieldOf(stored, "password_hash"), value: "x" },
      ]),
    ) as ValidationFailedError;

    expect(refusal).toBeInstanceOf(ValidationFailedError);
    expect(refusal.details).toEqual([
      expect.objectContaining({
        path: "values.password_hash",
        message: "Field `password_hash` is sensitive and is never written from the admin.",
      }),
    ]);
    expect(refusal.details[0]?.hint).not.toMatch(/unset|"sensitive": false/i);
  });

  it("refuses to write the primary key", () => {
    const stored = smuggle(USERS, "id", { editable: true });

    const refusal = refusalFrom(() =>
      updateStatement(RESOURCES, stored, [{ field: fieldOf(stored, "id"), value: "u2" }], "u1"),
    ) as ValidationFailedError;

    expect(refusal.details[0]?.path).toBe("values.id");
    expect(refusal.details[0]?.message).toContain("is the primary key");
  });

  it("refuses an insert carrying a key the database issues, even from a stored definition", () => {
    const stored = smuggle(USERS, "id", { editable: true });

    const refusal = refusalFrom(() =>
      insertStatement(RESOURCES, stored, [
        { field: fieldOf(stored, "id"), value: "u2" },
        { field: fieldOf(stored, "name"), value: "Ada" },
      ]),
    ) as ValidationFailedError;

    expect(refusal.details).toEqual([
      expect.objectContaining({
        path: "values.id",
        message: "Field `id` is the primary key of `users` and is issued by the database.",
      }),
    ]);
    expect(refusal.details[0]?.hint).toMatch(/"primaryKeyGeneration": "client"/);
  });

  it("refuses an update carrying a key even where the client issues keys", () => {
    const refusal = refusalFrom(() =>
      updateStatement(
        KEYED_RESOURCES,
        KEYED_USERS,
        [{ field: fieldOf(KEYED_USERS, "id"), value: "u2" }],
        "u1",
      ),
    ) as ValidationFailedError;

    expect(refusal.details[0]?.path).toBe("values.id");
    expect(refusal.details[0]?.message).toMatch(/addresses the record and is set when it is made/);
  });

  it("refuses to write a column nobody marked editable", () => {
    const refusal = refusalFrom(() =>
      updateStatement(RESOURCES, USERS, [{ field: fieldOf(USERS, "status"), value: "active" }], "u1"),
    ) as ValidationFailedError;

    expect(refusal.details[0]?.path).toBe("values.status");
    expect(refusal.details[0]?.message).toBe("Field `status` is not editable.");
  });

  it("refuses to write a json column", () => {
    const stored = smuggle(USERS, "preferences", { editable: true });

    const refusal = refusalFrom(() =>
      updateStatement(
        RESOURCES,
        stored,
        [{ field: fieldOf(stored, "preferences"), value: { theme: "dark" } }],
        "u1",
      ),
    ) as ValidationFailedError;

    expect(refusal.details[0]?.path).toBe("values.preferences");
    expect(refusal.details[0]?.message).toContain("has type `json`");
  });

  it("reports every refused field at once", () => {
    const stored = smuggle(smuggle(USERS, "password_hash", { editable: true }), "id", {
      editable: true,
    });

    const refusal = refusalFrom(() =>
      insertStatement(RESOURCES, stored, [
        { field: fieldOf(stored, "id"), value: "u2" },
        { field: fieldOf(stored, "password_hash"), value: "x" },
      ]),
    ) as ValidationFailedError;

    expect(refusal.details.map((detail) => detail.path)).toEqual([
      "values.id",
      "values.password_hash",
    ]);
  });

  it("refuses to serve a resource whose key is a secret", () => {
    const stored = smuggle(USERS, "id", { sensitive: true });

    const refusal = refusalFrom(() =>
      updateStatement(RESOURCES, stored, [{ field: fieldOf(stored, "name"), value: "Ada" }], "u1"),
    );

    expect(refusal).toBeInstanceOf(UnservableResourceError);
  });

  /**
   * The one thing a caller contributes is a key, which is looked up; what gets
   * written is the definition's own copy of it. Forcing a field whose key never
   * came from a definition is the last door, and it is shut in `quoteIdentifier`.
   */
  it("cannot be made to write an identifier a definition could not hold", () => {
    const hostile = '"name" = \'owned\' --';
    const stored: Resource = {
      ...USERS,
      fields: [
        ...USERS.fields,
        { ...fieldOf(USERS, "name"), key: hostile, editable: true } as Field,
      ],
    };

    expect(() =>
      insertStatement(RESOURCES, stored, [
        { field: fieldOf(stored, hostile), value: "x" },
      ]),
    ).toThrow(/is not a definition identifier and cannot be written into SQL/);
  });

  it("refuses a write that sets nothing at all", () => {
    expect(() => insertStatement(RESOURCES, USERS, [])).toThrow(
      /reached the builder with no fields to set/,
    );
  });
});
