import { describe, expect, it } from "vitest";
import { resourceIn } from "./definition.fixture";
import { changed, cleared, isNarrowed, readTableState, toSearchParams } from "./table-state";

const view = resourceIn("users").views.table;

function stateFrom(query: string) {
  return readTableState(new URLSearchParams(query), view);
}

describe("readTableState", () => {
  it("starts a table on its first page, sorted the way the definition asks", () => {
    expect(stateFrom("")).toEqual({
      page: 1,
      pageSize: 25,
      search: "",
      sort: { field: "created_at", direction: "desc" },
      filters: {},
    });
  });

  it("reads the whole of what an address carries", () => {
    const state = stateFrom(
      "page=3&pageSize=50&search=ada&sort=email&direction=asc" +
        "&filter[status]=active&filter[created_at][from]=2026-01-01",
    );

    expect(state).toEqual({
      page: 3,
      pageSize: 50,
      search: "ada",
      sort: { field: "email", direction: "asc" },
      filters: { status: "active", created_at: { from: "2026-01-01" } },
    });
  });

  it("ignores a filter this resource does not declare, so a stale link still opens", () => {
    expect(stateFrom("filter[plan]=pro").filters).toEqual({});
  });

  it("falls back to the default page size when the address asks for one nobody offers", () => {
    expect(stateFrom("pageSize=37").pageSize).toBe(25);
  });
});

describe("toSearchParams", () => {
  it("says nothing a default already says, so an untouched table has a clean address", () => {
    expect(toSearchParams(stateFrom(""), view).toString()).toBe("");
  });

  it("round-trips everything a table can be narrowed by", () => {
    const query =
      "page=3&pageSize=50&search=ada&sort=email&direction=asc" +
      "&filter[status]=active&filter[created_at][from]=2026-01-01&filter[created_at][to]=2026-06-30";
    const state = stateFrom(query);

    expect(readTableState(toSearchParams(state, view), view)).toEqual(state);
  });

  it("spells a sort out once it differs from the definition's own", () => {
    const state = changed(stateFrom(""), { sort: { field: "created_at", direction: "asc" } });

    expect(toSearchParams(state, view).get("direction")).toBe("asc");
  });
});

describe("changed", () => {
  it("returns to the first page, because page 7 of another question is nobody's page", () => {
    const state = changed(stateFrom("page=7"), { search: "ada" });

    expect(state.page).toBe(1);
  });

  it("keeps the page when the page is what changed", () => {
    expect(changed(stateFrom(""), { page: 4 }).page).toBe(4);
  });
});

describe("cleared", () => {
  it("drops what narrows the table and keeps how it is read", () => {
    const state = stateFrom("search=ada&filter[status]=active&pageSize=50&sort=email&direction=asc");

    expect(cleared(state)).toEqual({
      page: 1,
      pageSize: 50,
      search: "",
      sort: { field: "email", direction: "asc" },
      filters: {},
    });
  });
});

describe("isNarrowed", () => {
  it("is false for a table showing everything", () => {
    expect(isNarrowed(stateFrom("page=2"))).toBe(false);
  });

  it("is true once a search or a filter is answering for what is missing", () => {
    expect(isNarrowed(stateFrom("search=ada"))).toBe(true);
    expect(isNarrowed(stateFrom("filter[status]=active"))).toBe(true);
  });
});
