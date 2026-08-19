import {
  listRecordsQuerySchema,
  validateDefinition,
  type Definition,
  type DefinitionInput,
  type Field,
  type ListRecordsQuery,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { InvalidQueryError, UnservableResourceError } from "../../errors/domain-errors";
import { prismaDefinition } from "../mixed-case.fixture";
import { QueryBuilderService } from "./query-builder.service";

function definitionFrom(input: DefinitionInput, mutate: (draft: DefinitionInput) => void = () => {}): Definition {
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

function draftResource(draft: DefinitionInput, key: string): DefinitionInput["resources"][number] {
  const resource = draft.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
}

function listQuery(overrides: Record<string, unknown> = {}): ListRecordsQuery {
  return listRecordsQuerySchema.parse(overrides);
}

const SAAS = definitionFrom(saasDefinition);
const SAAS_RESOURCES = resourcesOf(SAAS);
const USERS = resourceOf(SAAS, "users");
const ORDERS = resourceOf(SAAS, "orders");

/** The refusal a call produced; fails the test if it produced none. */
function refusalFrom(build: () => unknown): Error {
  try {
    build();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the query builder to refuse");
}

describe("QueryBuilderService", () => {
  let builder: QueryBuilderService;

  beforeEach(() => {
    builder = new QueryBuilderService();
  });

  describe("records", () => {
    it("writes the whole page query out of the definition", () => {
      const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery());

      expect(rows.text).toBe(
        'select "t"."email" as "c0", "t"."name" as "c1", "t"."status" as "c2", ' +
          '"t"."organization_id" as "c3", "j0"."name" as "c4", "t"."created_at" as "c5", "t"."id" as "c6" ' +
          'from "users" as "t" ' +
          'left join "organizations" as "j0" on "j0"."id" = "t"."organization_id" ' +
          'order by "t"."created_at" desc, "t"."id" asc limit $1 offset $2',
      );
      expect(rows.values).toEqual([25, 0]);
    });

    it("counts the same rows without paying for the joins", () => {
      const { total } = builder.records(SAAS_RESOURCES, USERS, listQuery({ filter: { status: "active" } }));

      expect(total.text).toBe(
        'select count(*) as "total" from "users" as "t" where "t"."status" = $1',
      );
      expect(total.values).toEqual(["active"]);
      expect(total.text).not.toContain("left join");
    });

    it("keeps every sensitive field out of the select list", () => {
      const { rows, total } = builder.records(SAAS_RESOURCES, USERS, listQuery());

      expect(rows.text).not.toContain("password_hash");
      expect(total.text).not.toContain("password_hash");
      expect(rows.select.map((entry) => entry.key)).not.toContain("password_hash");
    });

    it("leaves hidden fields out of a list", () => {
      const organizations = resourceOf(SAAS, "organizations");

      const { rows } = builder.records(SAAS_RESOURCES, organizations, listQuery());

      // `settings` is hidden, so it is not a column and not in the payload.
      expect(rows.text).not.toContain("settings");
    });

    it("pages from the front of the page it was asked for", () => {
      const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ page: "3", pageSize: "20" }));

      expect(rows.text).toContain("limit $1 offset $2");
      expect(rows.values).toEqual([20, 40]);
    });

    it("quotes a Prisma-cased table and column exactly as written", () => {
      const prisma = definitionFrom(prismaDefinition);
      const { rows } = builder.records(resourcesOf(prisma), resourceOf(prisma, "User"), listQuery());

      expect(rows.text).toContain('from "User" as "t"');
      expect(rows.text).toContain('"t"."avatarUrl"');
      expect(rows.text).toContain('left join "Team" as "j0" on "j0"."id" = "t"."teamId"');
      expect(rows.text).toContain('"j0"."displayName"');
      // Never the folded spelling Postgres would look for without the quotes.
      expect(rows.text).not.toContain("avatarurl");
    });

    it("refuses a field key that could not have come from a validated definition", () => {
      const hostileKey = 'email", (select "password_hash" from "users") as "leak';

      // The front door is shut: this key cannot be authored in the first place.
      const authored = validateDefinition(
        structuredClone({
          ...saasDefinition,
          resources: saasDefinition.resources.map((resource) =>
            resource.key === "users"
              ? { ...resource, fields: [...resource.fields, { key: hostileKey, label: "X", type: "text" as const }] }
              : resource,
          ),
        }),
      );
      expect(authored.valid).toBe(false);

      // And the builder refuses it anyway, for a resource assembled by hand.
      const smuggled = structuredClone(USERS);
      smuggled.fields.push({ key: hostileKey, label: "X", type: "text", sensitive: false, hidden: false });
      smuggled.views.table.columns.push(hostileKey);

      expect(() => builder.records(SAAS_RESOURCES, smuggled, listQuery())).toThrow(
        /is not a definition identifier and cannot be written into SQL/,
      );
    });

    it("refuses to serve a resource whose primary key is a secret", () => {
      const smuggled = structuredClone(USERS);
      const identity = fieldOf(smuggled, smuggled.primaryKey);
      identity.sensitive = true;

      const refusal = refusalFrom(() => builder.records(SAAS_RESOURCES, smuggled, listQuery()));

      expect(refusal).toBeInstanceOf(UnservableResourceError);
      expect(refusal.message).toContain("its primary key `id` is marked sensitive");
      expect(refusalFrom(() => builder.record(SAAS_RESOURCES, smuggled, "1"))).toBeInstanceOf(
        UnservableResourceError,
      );
    });

    it("orders by the primary key alone when the definition's default sort is a secret", () => {
      const smuggled = structuredClone(USERS);
      fieldOf(smuggled, "created_at").sensitive = true;
      smuggled.views.table.columns = ["email"];
      smuggled.views.table.filters = [];

      const { rows } = builder.records(SAAS_RESOURCES, smuggled, listQuery());

      // The definition's own choice cannot fail a request, and cannot leak.
      expect(rows.text).toContain('order by "t"."id" asc');
      expect(rows.text).not.toContain("created_at");
    });

    describe("sorting", () => {
      it("sorts by a field the caller named", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ sort: "email", direction: "asc" }));

        expect(rows.text).toContain('order by "t"."email" asc, "t"."id" asc');
      });

      it("does not repeat the primary key when that is what it sorted by", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ sort: "id" }));

        expect(rows.text).toContain('order by "t"."id" asc limit');
      });

      it.each([
        ["a field that does not exist", "signup_date"],
        ["a sensitive field", "password_hash"],
      ])("refuses to sort by %s", (_case, sort) => {
        const refusal = refusalFrom(() => builder.records(SAAS_RESOURCES, USERS, listQuery({ sort })));

        expect(refusal).toBeInstanceOf(InvalidQueryError);
        expect(refusal.message).toContain(`Cannot sort resource \`users\` by \`${sort}\``);
        expect(refusal.message).toContain("Sortable fields: id, email, name, status");
        expect(refusal.message).not.toContain("password_hash.");
      });

      it("refuses to sort by a hidden field", () => {
        const definition = definitionFrom(saasDefinition, (draft) => {
          const users = draftResource(draft, "users");
          const notes = users.fields.find((field) => field.key === "notes");
          if (notes) notes.hidden = true;
          users.views.table.search = ["email", "name"];
        });

        const refusal = refusalFrom(() =>
          builder.records(resourcesOf(definition), resourceOf(definition, "users"), listQuery({ sort: "notes" })),
        );

        expect(refusal).toBeInstanceOf(InvalidQueryError);
      });
    });

    describe("searching", () => {
      it("looks in every field the view names, through one parameter", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ search: "acme" }));

        expect(rows.text).toContain(
          'where ("t"."email" ilike $1 or "t"."name" ilike $1 or "t"."notes" ilike $1)',
        );
        expect(rows.values).toEqual(["%acme%", 25, 0]);
      });

      it("takes the searcher's wildcards literally", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ search: "100%_off\\" }));

        expect(rows.values[0]).toBe("%100\\%\\_off\\\\%");
      });

      it("refuses to search a resource that declares nothing searchable", () => {
        const definition = definitionFrom(saasDefinition, (draft) => {
          draftResource(draft, "users").views.table.search = [];
        });

        const refusal = refusalFrom(() =>
          builder.records(resourcesOf(definition), resourceOf(definition, "users"), listQuery({ search: "acme" })),
        );

        expect(refusal).toBeInstanceOf(InvalidQueryError);
        expect(refusal.message).toContain("declares no searchable fields");
      });
    });

    describe("filtering", () => {
      it("matches an enum against one of its values", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ filter: { status: "active" } }));

        expect(rows.text).toContain('where "t"."status" = $1');
        expect(rows.values).toEqual(["active", 25, 0]);
      });

      it("binds a boolean as a boolean", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ filter: { is_active: "false" } }));

        expect(rows.values).toEqual([false, 25, 0]);
      });

      it("compares a relation against the key it was given", () => {
        const { rows } = builder.records(SAAS_RESOURCES, USERS, listQuery({ filter: { organization_id: "org-1" } }));

        expect(rows.text).toContain('where "t"."organization_id" = $1');
        expect(rows.values).toEqual(["org-1", 25, 0]);
      });

      it("reads both ends of a date range", () => {
        const { rows } = builder.records(
          SAAS_RESOURCES,
          USERS,
          listQuery({ filter: { created_at: { from: "2026-01-01", to: "2026-02-01" } } }),
        );

        expect(rows.text).toContain('where "t"."created_at" >= $1 and "t"."created_at" <= $2');
        expect(rows.values).toEqual(["2026-01-01", "2026-02-01", 25, 0]);
      });

      it("reads one end of a date range on its own", () => {
        const { rows } = builder.records(
          SAAS_RESOURCES,
          USERS,
          listQuery({ filter: { created_at: { from: "2026-01-01" } } }),
        );

        expect(rows.text).toContain('where "t"."created_at" >= $1');
        expect(rows.text).not.toContain("<=");
      });

      it("narrows by every filter it was given at once", () => {
        const { rows } = builder.records(
          SAAS_RESOURCES,
          USERS,
          listQuery({ search: "acme", filter: { status: "active", is_active: "true" } }),
        );

        expect(rows.text).toContain('ilike $1) and "t"."status" = $2 and "t"."is_active" = $3');
      });

      it.each([
        ["a field the view declares no filter on", { plan: "pro" }, "declares no filter on `plan`"],
        ["a value outside the enum", { status: "banned" }, "is not a value of enum field `status`"],
        ["something that is not a boolean", { is_active: "maybe" }, "takes `true` or `false`"],
        ["a single value for a range", { created_at: "2026-01-01" }, "is a date range"],
        ["a range for a single value", { status: { from: "a" } }, "takes a single value, not a range"],
        ["a range with neither end", { created_at: {} }, "needs a `from`, a `to`, or both"],
        ["a from that is not a date", { created_at: { from: "yesterday" } }, "is not a date"],
      ])("refuses %s", (_case, filter, message) => {
        const refusal = refusalFrom(() => builder.records(SAAS_RESOURCES, USERS, listQuery({ filter })));

        expect(refusal).toBeInstanceOf(InvalidQueryError);
        expect(refusal.message).toContain(message);
      });

      it("names the filters that would have worked", () => {
        const refusal = refusalFrom(() => builder.records(SAAS_RESOURCES, USERS, listQuery({ filter: { plan: "pro" } })));

        expect(refusal.message).toContain(
          "Filterable fields: status, is_active, organization_id, created_at.",
        );
      });
    });

    describe("relation labels", () => {
      it("labels a relation column from the target's label field", () => {
        const { rows } = builder.records(SAAS_RESOURCES, ORDERS, listQuery());

        expect(rows.text).toContain('left join "users" as "j0" on "j0"."id" = "t"."user_id"');
        expect(rows.text).toContain('"j0"."email"');
        expect(rows.select).toContainEqual(
          expect.objectContaining({ key: "user_id", kind: "label", alias: expect.any(String) }),
        );
      });

      it("labels it even when the resource declares no relationship at all", () => {
        const definition = definitionFrom(saasDefinition, (draft) => {
          const orders = draftResource(draft, "orders");
          orders.relationships = [];
          orders.views.detail.relatedLists = [];
        });

        const { rows } = builder.records(resourcesOf(definition), resourceOf(definition, "orders"), listQuery());

        expect(rows.text).toContain('left join "users" as "j0" on "j0"."id" = "t"."user_id"');
      });

      it("falls back to the target's primary key when it has no label field", () => {
        const definition = definitionFrom(saasDefinition, (draft) => {
          delete draftResource(draft, "users").labelField;
        });

        const { rows } = builder.records(resourcesOf(definition), resourceOf(definition, "orders"), listQuery());

        expect(rows.text).toContain('"j0"."id"');
      });

      it("refuses to point at a resource whose label is a secret", () => {
        const resources = new Map(SAAS_RESOURCES);
        const users = structuredClone(USERS);
        fieldOf(users, "email").sensitive = true;
        resources.set("users", users);

        const refusal = refusalFrom(() => builder.records(resources, ORDERS, listQuery()));

        expect(refusal).toBeInstanceOf(UnservableResourceError);
        expect(refusal.message).toContain("its label field `email` is marked sensitive");
      });
    });

    describe("a related page", () => {
      it("narrows the target's own list to the record that owns it", () => {
        const orders = resourceOf(SAAS, "orders");
        const { rows, total } = builder.records(SAAS_RESOURCES, orders, listQuery(), {
          field: fieldOf(orders, "user_id"),
          id: "user-1",
        });

        expect(rows.text).toContain('from "orders" as "t"');
        expect(rows.text).toContain('where "t"."user_id" = $1');
        expect(rows.values).toEqual(["user-1", 25, 0]);
        expect(total.text).toContain('where "t"."user_id" = $1');
        expect(total.values).toEqual(["user-1"]);
      });

      it("refuses to narrow on a column that is a secret", () => {
        const orders = structuredClone(ORDERS);
        fieldOf(orders, "user_id").sensitive = true;

        // Narrowing on it would answer, for any id the caller supplies, exactly
        // which records carry it — the column read back one value at a time.
        const refusal = refusalFrom(() =>
          builder.records(SAAS_RESOURCES, orders, listQuery(), {
            field: fieldOf(orders, "user_id"),
            id: "user-1",
          }),
        );

        expect(refusal).toBeInstanceOf(UnservableResourceError);
        expect(refusal.message).toContain("cannot be narrowed by `user_id`");
      });

      it("still allowlists against the target rather than whoever owns it", () => {
        const orders = resourceOf(SAAS, "orders");
        const owner = { field: fieldOf(orders, "user_id"), id: "user-1" };

        // `notes` is a field of `users`, not of `orders`.
        const refusal = refusalFrom(() =>
          builder.records(SAAS_RESOURCES, orders, listQuery({ sort: "notes" }), owner),
        );

        expect(refusal).toBeInstanceOf(InvalidQueryError);
        expect(refusal.message).toContain("Cannot sort resource `orders` by `notes`");
      });
    });
  });

  describe("record", () => {
    it("selects every field a list leaves out, except the secrets", () => {
      const query = builder.record(SAAS_RESOURCES, resourceOf(SAAS, "organizations"), "org-1");

      // Hidden is detail-only, so the detail is where it shows up.
      expect(query.text).toContain('"t"."settings"');
      expect(query.text).toContain('where "t"."id" = $1 limit 1');
      expect(query.values).toEqual(["org-1"]);
    });

    it("never selects a sensitive field, wherever it is shown", () => {
      const query = builder.record(SAAS_RESOURCES, USERS, "user-1");

      expect(query.text).not.toContain("password_hash");
      expect(query.select.map((entry) => entry.key)).not.toContain("password_hash");
    });

    it("labels a relation on the detail too, so a relation reads the same everywhere", () => {
      const query = builder.record(SAAS_RESOURCES, USERS, "user-1");

      expect(query.text).toContain('left join "organizations" as "j0"');
      expect(query.select).toContainEqual(expect.objectContaining({ key: "organization_id", kind: "label" }));
    });
  });

  describe("lookup", () => {
    it("reads one column of one record", () => {
      const query = builder.lookup(USERS, "user-1", fieldOf(USERS, "organization_id"));

      expect(query.text).toBe(
        'select "t"."organization_id" as "c0" from "users" as "t" where "t"."id" = $1 limit 1',
      );
      expect(query.values).toEqual(["user-1"]);
    });

    it("refuses to read a sensitive column even to bind it into the next query", () => {
      const refusal = refusalFrom(() => builder.lookup(USERS, "user-1", fieldOf(USERS, "password_hash")));

      expect(refusal).toBeInstanceOf(UnservableResourceError);
    });
  });
});
