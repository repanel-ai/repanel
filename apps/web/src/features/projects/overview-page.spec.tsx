import type { AgentTokenDto, ConnectionDto, DefinitionStatusDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./overview-page";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const API_URL = "https://api.repanel.test";

const CONNECTED: ConnectionDto = { kind: "postgres", host: "db.example.com", database: "crewbase" };
const UNUSED: AgentTokenDto = {
  id: "t_1",
  label: "Claude Code on my laptop",
  createdAt: "2026-08-20T10:00:00.000Z",
  lastUsedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("OverviewPage", () => {
  it("reports the three facts a project has, and none it was not told", async () => {
    show({ connection: CONNECTED, tokens: [UNUSED] });

    expect(await screen.findByText("db.example.com/crewbase")).toBeDefined();
    expect(screen.getByText("Nothing submitted yet")).toBeDefined();
    expect(screen.getByText("1 active")).toBeDefined();
    expect(screen.getByText("Never used")).toBeDefined();
  });

  it("says how far setup has got, and puts the command on the step that needs it", async () => {
    show({ connection: CONNECTED, tokens: [UNUSED] });

    expect(await screen.findByText("2 of 4 steps done")).toBeDefined();
    expect(
      screen.getByText(
        `claude mcp add --transport http repanel ${API_URL}/mcp --header "Authorization: Bearer <token>"`,
      ),
    ).toBeDefined();
  });

  it("puts a brand-new project on the first step, with nothing to copy yet", async () => {
    show({ connection: null, tokens: [] });

    expect(await screen.findByText("0 of 4 steps done")).toBeDefined();
    expect(screen.getByText("No database yet")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Copy command/ })).toBeNull();
  });

  it("says what went wrong instead of a checklist it cannot derive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: "not_found", message: "No such project" } }),
            { status: 404 },
          ),
      ),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "No such project");
    expect(screen.queryByText(/steps done/)).toBeNull();
  });
});

function show(facts: {
  connection: ConnectionDto | null;
  tokens: AgentTokenDto[];
  definition?: DefinitionStatusDto;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.endsWith("/connection")) {
        return facts.connection ? json(facts.connection) : new Response("", { status: 200 });
      }
      if (input.endsWith("/agent-tokens")) return json(facts.tokens);
      if (input.endsWith("/definition/status")) return json(facts.definition ?? { status: "none" });
      return new Response("", { status: 404 });
    }),
  );
  renderPage();
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/p/${PROJECT_ID}/overview`]}>
        <Routes>
          <Route path="/p/:id/overview" element={<OverviewPage apiUrl={API_URL} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
