import type { RecordDto, UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app";
import {
  adminDefinition,
  orderRecords,
  organizationRecord,
  organizationRecords,
  sparseUserRecord,
  userRecord,
  userRecords,
} from "./definition.fixture";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

describe("the record page", () => {
  it("names the record by its label field, and keeps its key to hand", async () => {
    renderAdmin("/a/acme/r/users/u_1");

    // `users` is labelled by `email`, so that is the name the record wears.
    expect(await screen.findByRole("heading", { level: 1 })).toHaveProperty(
      "textContent",
      "maya.okonkwo@northwind.io",
    );
    expect(screen.getByRole("button", { name: /u_1/ })).toBeDefined();
  });

  /**
   * v0 has no schema slot naming the record's status, so the header takes the
   * first enum of the first section — and says it in the tone the definition
   * gave that value, never one read out of its spelling.
   */
  it("wears the state the definition marked, and does not repeat it", async () => {
    await loaded(renderAdmin("/a/acme/r/users/u_1"));

    expect(screen.getByText("active").dataset.tone).toBe("positive");
    const account = sectionOf(screen.getByRole("heading", { name: "Account" }));
    expect(within(account).queryByText("Status")).toBeNull();
    expect(screen.getAllByText("active")).toHaveLength(1);
  });

  it("draws the sections and the related lists the definition declares, in its order", async () => {
    await loaded(renderAdmin("/a/acme/r/users/u_1"));

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Account",
      "Membership",
      "Activity",
      "Preferences",
      "Organization",
      "Orders",
    ]);
  });

  describe("says each value the way its type is said", () => {
    it("links an email, and a url away from the admin", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      const account = within(sectionOf(screen.getByRole("heading", { name: "Account" })));
      expect(
        account.getByRole("link", { name: "maya.okonkwo@northwind.io" }).getAttribute("href"),
      ).toBe("mailto:maya.okonkwo@northwind.io");

      const url = account.getByRole("link", { name: /cdn\.northwind\.io/ });
      expect(url.getAttribute("target")).toBe("_blank");
      expect(url.getAttribute("rel")).toBe("noopener noreferrer");
    });

    /**
     * The value came out of the customer's database, and a `url` column holds
     * `javascript:` as easily as `https:`. Anything this cannot vouch for is
     * shown as the text it is.
     */
    it("refuses to make a link out of a scheme it cannot vouch for", async () => {
      await loaded(
        renderAdmin("/a/acme/r/users/u_1", {
          record: {
            ...userRecord,
            values: { ...userRecord.values, avatar_url: "javascript:alert(1)" },
          },
        }),
      );

      expect(screen.getByText("javascript:alert(1)").tagName).toBe("SPAN");
      expect(screen.queryByRole("link", { name: "javascript:alert(1)" })).toBeNull();
    });

    it("marks a relation as one, and points at the record it names", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      const membership = within(sectionOf(screen.getByRole("heading", { name: "Membership" })));
      const relation = membership.getByRole("link", { name: "Northwind Labs" });
      expect(relation.getAttribute("href")).toBe("/a/acme/r/organizations/o_1");
      expect(membership.getByText("Northwind Labs").dataset.slot).toBe("relation");
    });

    it("answers a boolean in a word", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      expect(screen.getByText("Yes")).toBeDefined();
    });

    it("shows the day in one shape, with the clock beside it and the exact value on it", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      expect(screen.getByTitle("2026-07-14 09:12 UTC").textContent).toBe("14 Jul 202609:12 UTC");
      // A `date` is only a day, so it has no clock to show.
      expect(screen.getByTitle("2026-08-30").textContent).toBe("30 Aug 2026");
    });

    it("gives a quantity its grouping and keeps it in the data face", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      expect(screen.getByText("1,284").className).toContain("font-data");
    });

    it("keeps the line breaks somebody typed", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      const notes = screen.getByText(/Asked for SSO/);
      expect(notes.className).toContain("whitespace-pre-wrap");
      expect(notes.textContent).toContain("\n\n");
    });

    it("shows a structured value closed, and holds it pretty-printed", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      const preferences = sectionOf(screen.getByRole("heading", { name: "Preferences" }));
      const disclosure = preferences.querySelector("details");
      expect(disclosure?.open).toBe(false);
      expect(disclosure?.querySelector("pre")?.textContent).toContain('"theme": "dark"');
    });

    it("draws a nothing rather than leaving a field blank", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_2", { record: sparseUserRecord }));

      // `name` and `avatar_url` are both empty on this record.
      const account = sectionOf(screen.getByRole("heading", { name: "Account" }));
      expect(within(account).getAllByTitle("No value")).toHaveLength(2);
      // A relation pointing at nothing is a nothing, not a broken link.
      const membership = sectionOf(screen.getByRole("heading", { name: "Membership" }));
      expect(within(membership).queryByRole("link")).toBeNull();
    });
  });

  /** `hidden` means detail-only; `sensitive` means it never left the API. */
  it("shows a hidden field and has no row for a sensitive one", async () => {
    await loaded(renderAdmin("/a/acme/r/users/u_1"));

    const preferences = sectionOf(screen.getByRole("heading", { name: "Preferences" }));
    expect(preferences.querySelector("dt")?.textContent).toBe("Preferences");
    expect(screen.queryByText("Password hash")).toBeNull();
    // The mocked API never sent it either — the two halves of the same rule.
    expect(userRecord.values.password_hash).toBeUndefined();
  });

  describe("related lists", () => {
    it("draws the target resource's own columns, and links each row to its record", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      const orders = within(sectionOf(screen.getByRole("heading", { name: "Orders" })));
      const table = orders.getByRole("table");
      expect(within(table).getAllByRole("columnheader").map((head) => head.textContent?.trim())).toEqual([
        "Reference",
        "Customer",
        "Status",
        "Total (cents)",
        "Placed",
      ]);
      // A list with no address of its own cannot keep an ordering.
      expect(within(table).queryByRole("button", { name: "Reference" })).toBeNull();

      fireEvent.click(within(table).getByText("AC-10241"));
      await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/orders/o_1001"));
    });

    it("pages through the records the list could not fit", async () => {
      const asked = renderAdmin("/a/acme/r/users/u_1", { relatedTotal: 12 });
      await loaded(asked);

      const orders = within(sectionOf(screen.getByRole("heading", { name: "Orders" })));
      expect(orders.getByText("1–2 of 12")).toBeDefined();

      fireEvent.click(orders.getByRole("button", { name: "Next" }));

      await waitFor(() =>
        expect(asked().some((url) => url.includes("related/orders?page=2&pageSize=5"))).toBe(true),
      );
    });

    it("offers no paging when there is none to do", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1"));

      const orders = within(sectionOf(screen.getByRole("heading", { name: "Orders" })));
      expect(orders.queryByRole("button", { name: "Next" })).toBeNull();
    });

    it("says an empty list is empty in the definition's own words", async () => {
      await loaded(renderAdmin("/a/acme/r/users/u_1", { related: [], relatedTotal: 0 }));

      expect(await screen.findByText("No orders")).toBeDefined();
      expect(screen.getByText("Nothing links this user to any order.")).toBeDefined();
    });
  });

  /**
   * A list of other records is not another group of this record's facts, and
   * the design says so the one way it says it everywhere: the dotted rule.
   */
  it("marks a list of other records as belonging elsewhere", async () => {
    await loaded(renderAdmin("/a/acme/r/users/u_1"));

    const heading = screen.getByRole("heading", { name: "Orders" });
    expect(heading.querySelector("[data-slot='relation']")).not.toBeNull();
    // The record's own sections carry no such mark.
    expect(
      screen.getByRole("heading", { name: "Account" }).querySelector("[data-slot='relation']"),
    ).toBeNull();
  });

  describe("when the definition asks for tabs", () => {
    const ORG = "/a/acme/r/organizations/o_1";

    it("opens on the record's own facts, with a tab for each related list", async () => {
      renderAdmin(ORG, { record: organizationRecord });

      const tabs = await screen.findByRole("navigation", { name: "Record" });
      expect(within(tabs).getAllByRole("link").map((tab) => tab.textContent)).toEqual([
        "Details",
        "Users",
      ]);
      expect(within(tabs).getByRole("link", { name: "Details" }).getAttribute("aria-current")).toBe(
        "page",
      );
      expect(screen.getByRole("heading", { name: "Organization" })).toBeDefined();
    });

    it("puts the open tab in the address, and shows only that list", async () => {
      renderAdmin(`${ORG}?tab=members`, { record: organizationRecord, related: userRecords });

      const tabs = await screen.findByRole("navigation", { name: "Record" });
      expect(within(tabs).getByRole("link", { name: "Users" }).getAttribute("aria-current")).toBe(
        "page",
      );
      // The record's sections are not on this panel, and the list does not
      // repeat the name the tab has already given it.
      expect(screen.queryByRole("heading", { name: "Organization" })).toBeNull();
      expect(await screen.findByText("Maya Okonkwo")).toBeDefined();
      expect(screen.queryByRole("heading", { name: "Users" })).toBeNull();
    });

    it("keeps the way back to the table while moving between tabs", async () => {
      renderAdmin("/a/acme/r/organizations?search=north", { record: organizationRecord });

      fireEvent.click(await screen.findByText("Maya Okonkwo"));
      const tabs = await screen.findByRole("navigation", { name: "Record" });
      fireEvent.click(within(tabs).getByRole("link", { name: "Users" }));

      await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/organizations/u_1?tab=members"));
      const back = within(screen.getByRole("main")).getByRole("link", { name: "Organizations" });
      expect(back.getAttribute("href")).toBe("/a/acme/r/organizations?search=north");
    });

    it("falls back to the record's own facts when the address names no such tab", async () => {
      renderAdmin(`${ORG}?tab=nowhere`, { record: organizationRecord });

      const tabs = await screen.findByRole("navigation", { name: "Record" });
      expect(within(tabs).getByRole("link", { name: "Details" }).getAttribute("aria-current")).toBe(
        "page",
      );
    });
  });

  it("stacks the related lists on the page when the definition asks for that", async () => {
    await loaded(renderAdmin("/a/acme/r/users/u_1"));

    expect(screen.queryByRole("navigation", { name: "Record" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Organization" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Orders" })).toBeDefined();
  });

  describe("the way back", () => {
    it("returns to the table the operator was reading, filters and all", async () => {
      renderAdmin("/a/acme/r/users?search=maya&filter%5Bstatus%5D=active");

      fireEvent.click(await screen.findByText("Maya Okonkwo"));

      const back = await within(await screen.findByRole("main")).findByRole("link", { name: "Users" });
      expect(back.getAttribute("href")).toBe("/a/acme/r/users?search=maya&filter%5Bstatus%5D=active");
    });

    it("returns to the table's own default when the record was reached directly", async () => {
      renderAdmin("/a/acme/r/users/u_1");

      const back = await within(await screen.findByRole("main")).findByRole("link", { name: "Users" });
      expect(back.getAttribute("href")).toBe("/a/acme/r/users");
    });
  });

  describe("when the record is not there", () => {
    it("says so, without saying something went wrong", async () => {
      renderAdmin("/a/acme/r/users/u_9", { recordMissing: true });

      expect(await screen.findByText("This user is not here")).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("link", { name: "Back to Users" }).getAttribute("href")).toBe(
        "/a/acme/r/users",
      );
    });

    it("says what went wrong when something did, and offers to ask again", async () => {
      const asked = renderAdmin("/a/acme/r/users/u_1", {
        recordFails: "The database took too long to answer.",
      });

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        expect.stringContaining("The database took too long to answer."),
      );

      const before = asked().length;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(asked().length).toBeGreaterThan(before));
    });
  });

  it("draws the labels it already knows while the values are on their way", async () => {
    renderAdmin("/a/acme/r/users/u_1", { recordNeverArrives: true });

    expect((await screen.findByText("Loading record")).getAttribute("role")).toBe("status");
    // The sections and their field labels come out of the definition.
    expect(screen.getByText("Account")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.queryByText("maya.okonkwo@northwind.io")).toBeNull();
  });
});

interface AdminOptions {
  record?: RecordDto;
  recordMissing?: boolean;
  recordFails?: string;
  recordNeverArrives?: boolean;
  related?: RecordDto[];
  relatedTotal?: number;
}

/**
 * Waits for the record itself. The skeleton draws the same section headings —
 * that is the point of it — so a query that does not wait can answer from the
 * placeholder.
 */
async function loaded(asked: () => string[]): Promise<() => string[]> {
  await screen.findByRole("heading", { level: 1 });
  await screen.findByRole("heading", { name: "Orders" });
  return asked;
}

/** The section a heading introduces. */
function sectionOf(heading: HTMLElement): HTMLElement {
  const section = heading.closest("section");
  if (!section) throw new Error(`\`${heading.textContent ?? ""}\` is not inside a section`);
  return section;
}

function renderAdmin(path: string, options: AdminOptions = {}): () => string[] {
  const fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) return json(ADA);
    if (url.endsWith("/definition")) return json(adminDefinition);

    if (url.includes("/related/organization")) {
      return json(page(organizationRecords, organizationRecords.length));
    }
    if (url.includes("/related/")) {
      const records = options.related ?? orderRecords;
      return json(page(records, options.relatedTotal ?? records.length));
    }

    if (url.includes("/records/")) {
      if (options.recordNeverArrives) return new Promise<Response>(() => {});
      if (options.recordMissing) return failure(404, "not_found", "Record not found");
      if (options.recordFails) return failure(504, "query_timeout", options.recordFails);
      return json(options.record ?? userRecord);
    }

    if (url.includes("/records")) {
      return json({ records: userRecords, total: userRecords.length, page: 1, pageSize: 25 });
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

function page(records: RecordDto[], total: number) {
  return { records, total, page: 1, pageSize: 5 };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function failure(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), { status });
}

function currentUrl(): string {
  return screen.getByTestId("url").textContent ?? "";
}

function UrlProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="url">{`${location.pathname}${location.search}`}</span>;
}
