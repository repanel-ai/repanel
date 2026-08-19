import type { Field } from "@repanel/contracts";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resourceIn } from "./definition.fixture";
import { RecordCell } from "./record-cell";

const users = resourceIn("users");

afterEach(() => vi.unstubAllEnvs());

function fieldNamed(key: string): Field {
  const field = users.fields.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`the fixture has no field \`${key}\``);
  return field;
}

function renderCell(key: string, value: unknown) {
  return render(
    <MemoryRouter>
      <RecordCell
        projectKey="acme"
        field={fieldNamed(key)}
        value={value as never}
        isIdentity={key === users.primaryKey}
      />
    </MemoryRouter>,
  );
}

describe("RecordCell", () => {
  it("says nothing loudly: a state is a badge, and a quiet one", () => {
    renderCell("status", "active");

    expect(screen.getByText("active").dataset.treatment).toBe("quiet");
  });

  /**
   * Severity is not something a runtime may read out of a spelling. Until a
   * definition can say which states are grave, every state is stated the same
   * way — including one the definition never declared.
   */
  it("renders a state the definition never declared, just as quietly", () => {
    renderCell("status", "archived");

    expect(screen.getByText("archived").dataset.treatment).toBe("quiet");
  });

  it("marks a relation as one, and points at the record it names", () => {
    renderCell("organization_id", { id: "o_1", label: "Northwind Labs" });

    const link = screen.getByRole("link", { name: "Northwind Labs" });
    expect(link.getAttribute("href")).toBe("/a/acme/r/organizations/o_1");
    expect(screen.getByText("Northwind Labs").dataset.slot).toBe("relation");
  });

  it("falls back to the key when the record it points at cannot be named", () => {
    renderCell("organization_id", { id: "o_9", label: null });

    expect(screen.getByRole("link", { name: "o_9" })).toBeDefined();
  });

  it("points nowhere when a relation points nowhere", () => {
    renderCell("organization_id", { id: null, label: null });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTitle("No value")).toBeDefined();
  });

  it("humanizes a timestamp and keeps the exact one a hover away", () => {
    renderCell("created_at", "2026-07-14T09:12:00.000Z");

    expect(screen.getByText("14 Jul 2026").getAttribute("title")).toBe("2026-07-14 09:12 UTC");
  });

  /**
   * The API strips the zone from a `timestamp` column on purpose, so the day
   * and clock the customer stored survive the wire. Reading that back as local
   * time would put the offset it removed straight back in.
   */
  it("reads a timestamp with no zone as the clock it was written on", () => {
    vi.stubEnv("TZ", "Pacific/Auckland");

    renderCell("created_at", "2026-07-14T01:00:00.000");

    expect(screen.getByText("14 Jul 2026").getAttribute("title")).toBe("2026-07-14 01:00");
  });

  it("says a boolean in a mark, never in the word `true`", () => {
    renderCell("is_active", true);

    expect(screen.getByText("Yes")).toBeDefined();
    expect(screen.queryByText("true")).toBeNull();
  });

  it("says a false boolean too, rather than leaving a hole where an answer is", () => {
    renderCell("is_active", false);

    expect(screen.getByText("No")).toBeDefined();
  });

  it("shows an absent value as absent", () => {
    renderCell("name", null);

    expect(screen.getByTitle("No value")).toBeDefined();
  });

  it("groups the digits of a quantity", () => {
    render(
      <MemoryRouter>
        <RecordCell
          projectKey="acme"
          field={{ key: "total_cents", label: "Total", type: "number", sensitive: false, hidden: false }}
          value={129900}
          isIdentity={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/129.900/)).toBeDefined();
  });

  it("leaves an identifier's digits alone, because an id is not a quantity", () => {
    render(
      <MemoryRouter>
        <RecordCell
          projectKey="acme"
          field={{ key: "id", label: "ID", type: "number", sensitive: false, hidden: false }}
          value={129900}
          isIdentity
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("129900")).toBeDefined();
  });

  it("puts a machine-shaped value in the machine's face", () => {
    renderCell("email", "ada@example.com");

    expect(screen.getByText("ada@example.com").className).toContain("font-data");
  });
});
