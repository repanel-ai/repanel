import type { ActivityEventDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityList } from "./activity-list";
import { resourceIn } from "./definition.fixture";

const users = resourceIn("users");

function event(overrides: Partial<ActivityEventDto> = {}): ActivityEventDto {
  return {
    id: "e_1",
    kind: "action",
    actionKey: "suspend",
    actorEmail: "ada@acme.test",
    outcome: "ok",
    reason: null,
    before: null,
    after: null,
    at: "2026-08-26T02:16:00.000Z",
    ...overrides,
  };
}

/** Renders the panel over a stubbed answer, and waits for the lines to land. */
async function renderActivity(events: ActivityEventDto[], total = events.length) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ events, total, page: 1, pageSize: 5 }), { status: 200 }),
      ),
    ),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ActivityList projectKey="acme" resource={users} recordId="u_1" />
    </QueryClientProvider>,
  );

  await screen.findByRole("heading", { name: "Activity" });
  return screen.findByRole("table");
}

afterEach(() => vi.unstubAllGlobals());

describe("ActivityList", () => {
  it("says what happened, when, and who did it", async () => {
    const table = await renderActivity([event()]);
    const row = within(table).getAllByRole("row")[1];

    // The definition's own word for the action, so the log reads back the way
    // the button that ran it read.
    expect(within(row as HTMLElement).getByText("Suspend")).toBeDefined();
    expect(within(row as HTMLElement).getByText("ada@acme.test")).toBeDefined();
    expect(within(row as HTMLElement).getByText("26 Aug 2026")).toBeDefined();
  });

  it("names a form write in the runtime's own words, because a form has none of the definition's", async () => {
    const table = await renderActivity([
      event({ id: "e_c", kind: "create", actionKey: null }),
      event({ id: "e_u", kind: "update", actionKey: null }),
    ]);

    expect(within(table).getByText("Created")).toBeDefined();
    expect(within(table).getByText("Edited")).toBeDefined();
  });

  it("shows what a field went from and to, under the label the definition gave it", async () => {
    const table = await renderActivity([
      event({ before: { status: "active" }, after: { status: "suspended" } }),
    ]);
    const row = within(table).getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getByText("Status")).toBeDefined();
    expect(within(row).getByText("active")).toBeDefined();
    expect(within(row).getByText("suspended")).toBeDefined();
  });

  /**
   * The enum's own tone, as ink rather than as a fill — the treatment a form
   * row already gives it (DECISIONS #057). The line an operator opened this
   * panel to find is the one where a state moved.
   */
  it("inks an enum in the tone the definition gave the value", async () => {
    const table = await renderActivity([
      event({ before: { status: "active" }, after: { status: "suspended" } }),
    ]);
    const row = within(table).getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getByText("suspended").className).toContain("text-destructive-text");
    expect(within(row).getByText("active").className).toContain("text-positive-text");
  });

  it("shows only what a create put there, because it replaced nothing", async () => {
    const table = await renderActivity([
      event({ kind: "create", actionKey: null, before: null, after: { name: "Ada" } }),
    ]);
    const row = within(table).getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getByText("Ada")).toBeDefined();
    expect(within(row).queryByText("became")).toBeNull();
  });

  /**
   * A success is the ordinary case and wears nothing; the two lines worth
   * finding are the ones that did not go through, and they are told apart —
   * a refusal is a thing to argue with, a failure a thing to retry.
   */
  it("badges only the events that did not succeed, and says which kind", async () => {
    const table = await renderActivity([
      event({ id: "e_ok" }),
      event({ id: "e_no", outcome: "refused", reason: "action_rejected" }),
      event({ id: "e_bad", outcome: "failed", reason: "action_timeout" }),
    ]);

    const refused = within(table).getByText("action rejected");
    const failed = within(table).getByText("action timeout");

    expect(refused.dataset.tone).toBe("attention");
    expect(failed.dataset.tone).toBe("critical");
    expect(within(table).queryByText("ok")).toBeNull();
  });

  it("says an action that changed no column of ours changed none", async () => {
    const table = await renderActivity([event({ before: null, after: null })]);
    const row = within(table).getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getByTitle("No value")).toBeDefined();
  });

  /** An action the definition no longer declares still happened. */
  it("falls back to the key when the definition has forgotten the action", async () => {
    const table = await renderActivity([event({ actionKey: "archive" })]);

    expect(within(table).getByText("archive")).toBeDefined();
  });

  it("says so when nothing has been done to the record", async () => {
    await renderActivity([]);

    expect(screen.getByText("No activity")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("offers the rest only when there is more than one page of it", async () => {
    await renderActivity([event()], 12);

    expect(screen.getByRole("button", { name: "Next" })).toBeDefined();
    expect(screen.getByText("12 events")).toBeDefined();
  });

  it("says what went wrong when the log itself could not be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { code: "not_found", message: "Project not found" } }), {
            status: 404,
          }),
        ),
      ),
    );

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ActivityList projectKey="acme" resource={users} recordId="u_1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Project not found"));
  });
});
