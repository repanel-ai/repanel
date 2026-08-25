import type { Field } from "@repanel/contracts";
import type { QueryResult } from "pg";
import type { SelectEntry } from "../query/columns.js";
import { toOptionDtos, toRecordDtos, toTotal } from "./records.mapper.js";

/** The oids node-postgres reads each of the three date-ish types with. */
const DATE = 1082;
const TIMESTAMP = 1114;
const TIMESTAMPTZ = 1184;
const TEXT = 25;

function field(key: string, type: Field["type"], extra: Record<string, unknown> = {}): Field {
  return { key, label: key, type, sensitive: false, hidden: false, ...extra } as Field;
}

function value(alias: string, key: string, type: Field["type"]): SelectEntry {
  return { alias, key, kind: "value", field: field(key, type) };
}

function label(alias: string, key: string, type: Field["type"]): SelectEntry {
  return { alias, key, kind: "label", field: field(`${key}_label`, type) };
}

function resultOf(
  types: Record<string, number>,
  rows: Array<Record<string, unknown>>,
): QueryResult {
  return {
    rows,
    fields: Object.entries(types).map(([name, dataTypeID]) => ({ name, dataTypeID })),
    rowCount: rows.length,
    command: "SELECT",
  } as unknown as QueryResult;
}

describe("toRecordDtos", () => {
  it("addresses a record by its primary key and leaves it out of the values", () => {
    const entries = [value("c0", "email", "email"), value("c1", "id", "text")];
    const result = resultOf({ c0: TEXT, c1: TEXT }, [{ c0: "ada@acme.test", c1: "user-1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record).toEqual({ id: "user-1", values: { email: "ada@acme.test", id: "user-1" } });
  });

  it("reads a date back as the day the customer stored", () => {
    const entries = [value("c0", "signed_up_on", "date"), value("c1", "id", "text")];
    // What the driver builds for `2026-01-01`: local midnight, whose UTC day is
    // the one before it anywhere west of Greenwich.
    const result = resultOf({ c0: DATE, c1: TEXT }, [{ c0: new Date(2026, 0, 1), c1: "1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.signed_up_on).toBe("2026-01-01");
  });

  it("reads a zone-less timestamp back as the clock the customer stored", () => {
    const entries = [value("c0", "created_at", "dateTime"), value("c1", "id", "text")];
    const result = resultOf({ c0: TIMESTAMP, c1: TEXT }, [{ c0: new Date(2026, 7, 19, 10, 0, 0), c1: "1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    // No `Z`: the column carries no zone, so neither does the answer.
    expect(record?.values.created_at).toBe("2026-08-19T10:00:00.000");
  });

  it("reads a timestamptz back as the instant it is", () => {
    const entries = [value("c0", "created_at", "dateTime"), value("c1", "id", "text")];
    const result = resultOf({ c0: TIMESTAMPTZ, c1: TEXT }, [
      { c0: new Date("2026-08-19T10:00:00.000Z"), c1: "1" },
    ]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.created_at).toBe("2026-08-19T10:00:00.000Z");
  });

  it.each([
    ["an integer", "42", 42],
    ["a scale the database is keeping", "1.50", "1.50"],
    ["an id past what a JSON number holds", "9007199254740993", "9007199254740993"],
  ])("returns %s as %p", (_case, raw, expected) => {
    const entries = [value("c0", "total_cents", "number"), value("c1", "id", "text")];
    const result = resultOf({ c0: 1700, c1: TEXT }, [{ c0: raw, c1: "1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.total_cents).toBe(expected);
  });

  it("passes a json value through as it was parsed", () => {
    const entries = [value("c0", "metadata", "json"), value("c1", "id", "text")];
    const result = resultOf({ c0: 3802, c1: TEXT }, [{ c0: { source: "web", tags: [1, 2] }, c1: "1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.metadata).toEqual({ source: "web", tags: [1, 2] });
  });

  it("gives a relation the key it points at and what to read instead", () => {
    const entries = [
      value("c0", "organization_id", "relation"),
      label("c1", "organization_id", "text"),
      value("c2", "id", "text"),
    ];
    const result = resultOf({ c0: TEXT, c1: TEXT, c2: TEXT }, [
      { c0: "org-1", c1: "Acme", c2: "user-1" },
    ]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.organization_id).toEqual({ id: "org-1", label: "Acme" });
  });

  it("says nothing for a relation whose row is not there", () => {
    const entries = [
      value("c0", "organization_id", "relation"),
      label("c1", "organization_id", "text"),
      value("c2", "id", "text"),
    ];
    const result = resultOf({ c0: TEXT, c1: TEXT, c2: TEXT }, [{ c0: "org-9", c1: null, c2: "user-1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.organization_id).toEqual({ id: "org-9", label: null });
  });

  it("writes a label as text whatever type it was read as", () => {
    const entries = [
      value("c0", "user_id", "relation"),
      label("c1", "user_id", "number"),
      value("c2", "id", "text"),
    ];
    const result = resultOf({ c0: TEXT, c1: 1700, c2: TEXT }, [{ c0: "u1", c1: "42", c2: "1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values.user_id).toEqual({ id: "u1", label: "42" });
  });

  it("carries a null through as a null", () => {
    const entries = [value("c0", "name", "text"), value("c1", "created_at", "dateTime"), value("c2", "id", "text")];
    const result = resultOf({ c0: TEXT, c1: TIMESTAMPTZ, c2: TEXT }, [{ c0: null, c1: null, c2: "1" }]);

    const [record] = toRecordDtos(result, entries, "id");

    expect(record?.values).toEqual({ name: null, created_at: null, id: "1" });
  });

  it("refuses a query that does not select what addresses a record", () => {
    const entries = [value("c0", "email", "email")];

    expect(() => toRecordDtos(resultOf({ c0: TEXT }, []), entries, "id")).toThrow(
      /does not select the identity field `id`/,
    );
  });
});

describe("toTotal", () => {
  it("reads the count back as a number, which int8 does not arrive as", () => {
    expect(toTotal("42")).toBe(42);
    expect(toTotal("0")).toBe(0);
  });

  it("refuses a count that is not one", () => {
    expect(() => toTotal(undefined)).toThrow(/a row count came back as/);
  });
});

describe("toOptionDtos", () => {
  it("reads a record as the key that would be written and the name it is chosen by", () => {
    const result = resultOf({ c0: TEXT, c1: TEXT }, [{ c0: "org-1", c1: "Acme" }]);

    expect(toOptionDtos(result, field("name", "text"))).toEqual([{ id: "org-1", label: "Acme" }]);
  });

  it("says a record has no name rather than inventing one", () => {
    const result = resultOf({ c0: TEXT, c1: TEXT }, [{ c0: "org-1", c1: null }]);

    expect(toOptionDtos(result, field("name", "text"))).toEqual([{ id: "org-1", label: null }]);
  });

  it("reads a label the same way the record beside it is read", () => {
    const result = resultOf({ c0: TEXT, c1: DATE }, [{ c0: "org-1", c1: new Date(2026, 0, 1) }]);

    expect(toOptionDtos(result, field("opened_on", "date"))).toEqual([
      { id: "org-1", label: "2026-01-01" },
    ]);
  });

  it("refuses a row that came back with no key", () => {
    const result = resultOf({ c0: TEXT, c1: TEXT }, [{ c0: null, c1: "Acme" }]);

    expect(() => toOptionDtos(result, field("name", "text"))).toThrow(/primary key/);
  });
});
