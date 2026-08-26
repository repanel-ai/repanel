import type { ProjectDto, ProjectMembershipDto } from "@repanel/contracts";
import { Toaster } from "@repanel/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Landing } from "./landing";

const RUNTIME_URL = "https://admin.repanel.test";

const CREWBASE: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

const LEDGER: ProjectDto = {
  id: "1d4e5f60-7a8b-49c0-b1d2-e3f4a5b60718",
  name: "Ledger",
  key: "ledger-d2s7u4",
  createdAt: "2026-08-19T12:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("Landing", () => {
  it("gives an owner the console", async () => {
    show([{ project: CREWBASE, role: "owner" }]);

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeDefined();
    expect(screen.getByRole("button", { name: "New project" })).toBeDefined();
  });

  it("sends somebody who only operates one admin straight to it", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    show([{ project: CREWBASE, role: "operator" }]);

    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      "Opening Crewbase…",
    );
    expect(replace).toHaveBeenCalledWith(`${RUNTIME_URL}/a/crewbase-a3k9x2`);
    // No console around it: there is no page in there they could open.
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  });

  it("asks a multi-project operator which admin, and nothing else", async () => {
    show([
      { project: CREWBASE, role: "operator" },
      { project: LEDGER, role: "operator" },
    ]);

    expect(await screen.findByRole("heading", { name: "Your admins" })).toBeDefined();
    expect(screen.getByText("2 to choose from")).toBeDefined();

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `${RUNTIME_URL}/a/crewbase-a3k9x2`,
      `${RUNTIME_URL}/a/ledger-d2s7u4`,
    ]);
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  });

  it("gives an owner who also operates somebody else's admin a way into both", async () => {
    show([
      { project: CREWBASE, role: "owner" },
      { project: LEDGER, role: "operator" },
    ]);

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Admins you use" })).toBeDefined();
    expect(screen.getByRole("link", { name: /Ledger/ }).getAttribute("href")).toBe(
      `${RUNTIME_URL}/a/ledger-d2s7u4`,
    );
  });

  it("keeps the console for an account that is on nothing at all", async () => {
    show([]);

    expect(await screen.findByText("No projects yet")).toBeDefined();
  });

  it("says what went wrong rather than guessing where to send anybody", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: "unexpected_error", message: "RePanel is down" } }),
            { status: 500 },
          ),
      ),
    );
    renderLanding();

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "RePanel is down");
  });
});

function show(memberships: ProjectMembershipDto[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input === "/api/projects") {
        return new Response(JSON.stringify(memberships), { status: 200 });
      }
      // The definition chip on each owned card; not what these cases are about.
      return new Response(JSON.stringify({ draft: { status: "none" }, published: null, unpublishedChanges: false }), {
        status: 200,
      });
    }),
  );
  renderLanding();
}

function renderLanding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster>
        <MemoryRouter initialEntries={["/"]}>
          <Landing runtimeUrl={RUNTIME_URL} />
        </MemoryRouter>
      </Toaster>
    </QueryClientProvider>,
  );
}
