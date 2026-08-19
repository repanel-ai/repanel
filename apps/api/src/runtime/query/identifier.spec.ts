import { column, quoteIdentifier } from "./identifier";

describe("quoteIdentifier", () => {
  it("quotes what a definition may legally name", () => {
    expect(quoteIdentifier("users")).toBe('"users"');
    expect(quoteIdentifier("organization_id")).toBe('"organization_id"');
  });

  it("keeps the case a Prisma schema was written in", () => {
    // Unquoted, Postgres would fold both and then fail to find them.
    expect(quoteIdentifier("User")).toBe('"User"');
    expect(quoteIdentifier("avatarUrl")).toBe('"avatarUrl"');
  });

  it("refuses anything that is not a definition identifier", () => {
    const hostile = ['email"; drop table users; --', "first name", "1st", "café", "", "a-b", "t.x"];

    for (const value of hostile) {
      expect(() => quoteIdentifier(value)).toThrow(/cannot be written into SQL/);
    }
  });
});

describe("column", () => {
  it("quotes both halves", () => {
    expect(column("t", "avatarUrl")).toBe('"t"."avatarUrl"');
  });

  it("refuses a table alias that is not an identifier either", () => {
    expect(() => column('t" x', "email")).toThrow(/cannot be written into SQL/);
  });
});
