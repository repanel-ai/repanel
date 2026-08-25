import {
  validateDefinition,
  OPTIONS_LIMIT,
  type Definition,
  type DefinitionInput,
  type Field,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { UnservableResourceError } from "../errors.js";
import { prismaDefinition } from "../fixtures/mixed-case.js";
import { optionsStatement } from "./options.js";

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

function resourceOf(definition: Definition, key: string): Resource {
  const resource = definition.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
}

/**
 * A resource with a field changed after validation ran — the shape a definition
 * stored before a rule existed has, and the only way to put in front of the
 * builder something the validator would have stopped.
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
  throw new Error("expected the options builder to refuse");
}

const SAAS = definitionFrom(saasDefinition);
const ORGANIZATIONS = resourceOf(SAAS, "organizations");
const USERS = resourceOf(SAAS, "users");

describe("optionsStatement", () => {
  it("reads the key and the label, and nothing else", () => {
    const query = optionsStatement(ORGANIZATIONS);

    expect(query.text).toBe(
      'select "t"."id" as "c0", "t"."name" as "c1" from "organizations" as "t"' +
        ' order by "t"."name" asc, "t"."id" asc limit $1',
    );
    expect(query.values).toEqual([OPTIONS_LIMIT]);
  });

  it("matches the label against the term, bound", () => {
    const query = optionsStatement(ORGANIZATIONS, "acme");

    expect(query.text).toBe(
      'select "t"."id" as "c0", "t"."name" as "c1" from "organizations" as "t"' +
        ' where "t"."name" ilike $1 order by "t"."name" asc, "t"."id" asc limit $2',
    );
    expect(query.values).toEqual(["%acme%", OPTIONS_LIMIT]);
  });

  it("means `%` and `_` itself, never the searcher", () => {
    expect(optionsStatement(ORGANIZATIONS, "100%_off").values[0]).toBe("%100\\%\\_off%");
  });

  it("never offers more than a picker shows, whatever it is asked", () => {
    const query = optionsStatement(ORGANIZATIONS, "a");

    expect(query.text).toContain("limit $2");
    expect(query.values.at(-1)).toBe(OPTIONS_LIMIT);
  });

  it("reads a label that is not text as text, so a key can be typed at", () => {
    const dated = definitionFrom(saasDefinition, (draft) => {
      const organizations = draft.resources.find((resource) => resource.key === "organizations");
      if (!organizations) throw new Error("the fixture has no `organizations`");
      organizations.labelField = "created_at";
    });

    const query = optionsStatement(resourceOf(dated, "organizations"), "2026");

    expect(query.text).toContain('where "t"."created_at"::text ilike $1');
    expect(query.text).toContain('order by "t"."created_at" asc, "t"."id" asc');
  });

  it("falls back to the key where the resource is named by nothing else", () => {
    const unnamed = definitionFrom(saasDefinition, (draft) => {
      const organizations = draft.resources.find((resource) => resource.key === "organizations");
      if (!organizations) throw new Error("the fixture has no `organizations`");
      delete organizations.labelField;
    });

    const query = optionsStatement(resourceOf(unnamed, "organizations"), "org_");

    expect(query.text).toBe(
      'select "t"."id" as "c0", "t"."id" as "c1" from "organizations" as "t"' +
        ' where "t"."id" ilike $1 order by "t"."id" asc limit $2',
    );
  });

  it("quotes every identifier, so a mixed-case schema can be pointed at", () => {
    const prisma = definitionFrom(prismaDefinition);

    const query = optionsStatement(resourceOf(prisma, "Team"), "ops");

    expect(query.text).toBe(
      'select "t"."id" as "c0", "t"."displayName" as "c1" from "Team" as "t"' +
        ' where "t"."displayName" ilike $1 order by "t"."displayName" asc, "t"."id" asc limit $2',
    );
  });

  /**
   * The validator refuses a sensitive label field outright, so nothing an agent
   * submits reaches this. A definition stored before that rule existed still
   * can, and these are the walls it meets — the same pair every other read has.
   */
  it("refuses a resource whose label field is sensitive", () => {
    const secretive = smuggle(ORGANIZATIONS, "name", { sensitive: true });

    const refusal = refusalFrom(() => optionsStatement(secretive, "acme"));

    expect(refusal).toBeInstanceOf(UnservableResourceError);
    expect(refusal.message).toContain("cannot be pointed at");
    expect(refusal.message).toContain("`name`");
  });

  it("refuses a resource whose key is sensitive", () => {
    const secretive = smuggle(USERS, "id", { sensitive: true });

    const refusal = refusalFrom(() => optionsStatement(secretive, "ada"));

    expect(refusal).toBeInstanceOf(UnservableResourceError);
    expect(refusal.message).toContain("`id`");
  });

  it("never writes a sensitive column into the statement, term or not", () => {
    const secretive = smuggle(ORGANIZATIONS, "name", { sensitive: true });

    expect(refusalFrom(() => optionsStatement(secretive))).toBeInstanceOf(UnservableResourceError);
  });
});
