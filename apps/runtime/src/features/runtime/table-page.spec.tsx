import type { RecordDto, UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app";
import { adminDefinition, userRecords } from "./definition.fixture";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

describe("the table page", () => {
  it("draws the columns the definition declares, and the resource it is on", async () => {
    renderAdmin("/a/acme/r/users");

    expect(await screen.findByRole("heading", { name: "Users" })).toBeDefined();
    const headers = await screen.findAllByRole("columnheader");
    expect(headers.map((header) => header.textContent?.trim())).toEqual([
      "Email",
      "Name",
      "Status",
      "Organization",
      "Created",
    ]);
  });

  it("says how many records there are to page through", async () => {
    renderAdmin("/a/acme/r/users", { total: 1284 });

    expect(await screen.findByText("1,284 records")).toBeDefined();
  });

  it("renders each value the way its type is said", async () => {
    renderAdmin("/a/acme/r/users");

    expect(await screen.findByRole("link", { name: "Northwind Labs" })).toBeDefined();

    // Inside the table: `active` is also one of the status filter's options.
    const table = within(screen.getByRole("table"));
    expect(table.getByText("active").dataset.treatment).toBe("quiet");
    expect(table.getByText("14 Jul 2026")).toBeDefined();
  });

  it("distinguishes a table with nothing in it from one with nothing matching", async () => {
    renderAdmin("/a/acme/r/users", { records: [], total: 0 });

    expect(await screen.findByText("No records yet")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("offers the way back when a search is what emptied the table", async () => {
    renderAdmin("/a/acme/r/users?search=zzz", { records: [], total: 0 });

    expect(await screen.findByText("No matches")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users"));
  });

  it("shows the shape of the table while it is still arriving", async () => {
    renderAdmin("/a/acme/r/users", { recordsNeverArrive: true });

    // A live region says the wait out loud; `status` names itself from nothing,
    // so the announcement is the text it carries.
    expect((await screen.findByText("Loading records")).getAttribute("role")).toBe("status");
    expect(screen.queryByRole("cell")).toBeNull();
    // The columns are the definition's, so they are known before the data is.
    expect(await screen.findAllByRole("columnheader")).toHaveLength(5);
  });

  it("says what went wrong, and offers to ask again", async () => {
    const asked = renderAdmin("/a/acme/r/users", { recordsFail: "The database took too long to answer." });

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("The database took too long to answer."),
    );

    const before = asked().length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(asked().length).toBeGreaterThan(before));
  });

  it("sorts by the column whose header was pressed", async () => {
    renderAdmin("/a/acme/r/users");

    fireEvent.click(await screen.findByRole("button", { name: "Email" }));

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users?sort=email&direction=asc"));
    const header = screen.getByRole("columnheader", { name: /Email/ });
    expect(header.getAttribute("aria-sort")).toBe("ascending");
  });

  it("turns a sort around when the same header is pressed again", async () => {
    renderAdmin("/a/acme/r/users?sort=email&direction=asc");

    fireEvent.click(await screen.findByRole("button", { name: "Email" }));

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users?sort=email&direction=desc"));
  });

  it("puts a filter in the address, where it can be shared and taken back", async () => {
    renderAdmin("/a/acme/r/users");

    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "suspended" } });

    await waitFor(() =>
      expect(currentUrl()).toBe("/a/acme/r/users?filter%5Bstatus%5D=suspended"),
    );
  });

  it("puts a search in the address once the typing settles", async () => {
    renderAdmin("/a/acme/r/users");

    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "ada" } });

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users?search=ada"));
  });

  it("gives the search box the `/` key", async () => {
    renderAdmin("/a/acme/r/users");
    const search = await screen.findByRole("searchbox");

    fireEvent.keyDown(document.body, { key: "/" });

    expect(document.activeElement).toBe(search);
  });

  it("pages, and says which page it is on", async () => {
    renderAdmin("/a/acme/r/users", { total: 60 });

    expect(await screen.findByText("1–2 of 60")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users?page=2"));
  });

  it("leaves a relation to its own record when the keyboard activates it", async () => {
    renderAdmin("/a/acme/r/users");
    const relation = await screen.findByRole("link", { name: "Northwind Labs" });

    fireEvent.keyDown(relation, { key: "Enter" });

    // The row is on its way somewhere else; a key pressed on the link is the
    // link's to answer.
    expect(currentUrl()).toBe("/a/acme/r/users");
  });

  it("does not carry a stray space into the address", async () => {
    renderAdmin("/a/acme/r/users");

    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "ada " } });

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users?search=ada"));
  });

  it("opens the record whose row was clicked", async () => {
    renderAdmin("/a/acme/r/users");

    fireEvent.click(await screen.findByText("Maya Okonkwo"));

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users/u_1"));
  });

  it("keeps the admin standing when a link names a resource that is gone", async () => {
    renderAdmin("/a/acme/r/nowhere");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("nowhere"),
    );
  });
});

describe("the shell", () => {
  it("navigates from the definition, in the groups it declares", async () => {
    renderAdmin("/a/acme/r/users");

    const nav = await screen.findByRole("navigation");
    expect(within(nav).getByText("Customers")).toBeDefined();
    expect(within(nav).getByRole("link", { name: "Users" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Orders" })).toBeDefined();
  });

  it("opens on the first resource the navigation names", async () => {
    renderAdmin("/a/acme");

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/organizations"));
  });
});

interface AdminOptions {
  records?: RecordDto[];
  total?: number;
  recordsFail?: string;
  recordsNeverArrive?: boolean;
}

/**
 * Renders the whole admin against the shared fixture definition and a stubbed
 * API, and answers with the paths that were asked for.
 */
function renderAdmin(path: string, options: AdminOptions = {}): () => string[] {
  const records = options.records ?? userRecords;
  const fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) return json(ADA);
    if (url.endsWith("/definition")) return json(adminDefinition);
    if (url.includes("/records")) {
      if (options.recordsNeverArrive) return new Promise<Response>(() => {});
      if (options.recordsFail) {
        return new Response(
          JSON.stringify({ error: { code: "query_timeout", message: options.recordsFail } }),
          { status: 504 },
        );
      }
      return json({ records, total: options.total ?? records.length, page: 1, pageSize: 25 });
    }
    throw new Error(`nothing should have asked for ${url}`);
  });
  vi.stubGlobal("fetch", fetch);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <UrlProbe />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return () => fetch.mock.calls.map((call) => String(call[0]));
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/** The address the admin is currently at, as the router sees it. */
function currentUrl(): string {
  return screen.getByTestId("url").textContent ?? "";
}

function UrlProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="url">{`${location.pathname}${location.search}`}</span>;
}
