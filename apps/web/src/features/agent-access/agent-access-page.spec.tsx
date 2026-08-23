import type { AgentTokenDto, MintedAgentTokenDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AgentAccessPage } from "./agent-access-page";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const API_URL = "https://api.repanel.test";
const TOKEN = `rpk_${"a".repeat(40)}`;

const LISTED: AgentTokenDto = {
  id: "token-1",
  label: "Claude Code on my laptop",
  createdAt: "2026-08-19T09:30:00.000Z",
  lastUsedAt: null,
};

const MINTED: MintedAgentTokenDto = { ...LISTED, token: TOKEN };

afterEach(() => vi.unstubAllGlobals());

describe("AgentAccessPage", () => {
  it("lists what has been minted, without the tokens themselves", async () => {
    show();

    expect(await screen.findByText("Claude Code on my laptop")).toBeDefined();
    expect(screen.getByText("Never")).toBeDefined();
    expect(screen.queryByText(TOKEN)).toBeNull();
  });

  it("shows a minted token once, and says that is the only time", async () => {
    show();

    await mint();

    expect(await screen.findByText(TOKEN)).toBeDefined();
    expect(screen.getByText(/you will not see it again/)).toBeDefined();
  });

  it("writes the token into the setup snippet while it is on screen", async () => {
    show();

    await mint();

    expect(
      await screen.findByText(
        `claude mcp add --transport http repanel ${API_URL}/mcp --header "Authorization: Bearer ${TOKEN}"`,
      ),
    ).toBeDefined();
  });

  it("has no copy of the token left once it is dismissed", async () => {
    show();
    await mint();

    fireEvent.click(await screen.findByRole("button", { name: "I have copied it" }));

    await waitFor(() => expect(screen.queryByText(TOKEN)).toBeNull());
    // The snippet goes back to naming the placeholder: there is nothing to fill in.
    expect(
      screen.getByText(
        `claude mcp add --transport http repanel ${API_URL}/mcp --header "Authorization: Bearer <token>"`,
      ),
    ).toBeDefined();
  });

  it("never asks for the action secret until somebody asks for it", async () => {
    const fetched = show();
    await screen.findByText("Claude Code on my laptop");

    expect(paths(fetched)).not.toContain(`/api/projects/${PROJECT_ID}/action-secret`);

    fireEvent.click(screen.getByRole("button", { name: "Reveal action secret" }));

    await waitFor(() => expect(screen.getByText("s3cret-signing-key")).toBeDefined());
  });
});

async function mint() {
  fireEvent.change(await screen.findByLabelText("New token"), {
    target: { value: "Claude Code on my laptop" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Mint token" }));
}

/** Every path the section has asked for so far, in order. */
function paths(fetched: { mock: { calls: unknown[][] } }): string[] {
  return fetched.mock.calls.map((call) => String(call[0]));
}

function show() {
  const fetched = vi.fn(async (input: string, init?: RequestInit) => {
    if (input.endsWith("/agent-tokens") && init?.method === "POST") return json(MINTED);
    if (input.endsWith("/agent-tokens")) return json([LISTED]);
    if (input.endsWith("/action-secret")) return json({ secret: "s3cret-signing-key" });
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetched);
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(async () => {}) } });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/p/${PROJECT_ID}/agents`]}>
        <Routes>
          <Route path="/p/:id/agents" element={<AgentAccessPage apiUrl={API_URL} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetched;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
