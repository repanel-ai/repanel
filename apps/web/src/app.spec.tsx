import type { ProjectDto, UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

const CREWBASE: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("sends a visitor with no session to the login page", async () => {
    renderAt("/", null);

    expect(await screen.findByText("Sign in to RePanel")).toBeDefined();
  });

  it("lets a signed-in visitor through to their projects", async () => {
    renderAt("/", ADA);

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeDefined();
    expect(await screen.findByText("crewbase-a3k9x2")).toBeDefined();
  });

  it("opens one project on its own page", async () => {
    renderAt(`/p/${CREWBASE.id}`, ADA);

    expect(await screen.findByRole("heading", { name: "Crewbase" })).toBeDefined();
    expect(await screen.findByText("Connection")).toBeDefined();
    expect(await screen.findByText("Agent access")).toBeDefined();
    expect(await screen.findByText("Definition")).toBeDefined();
  });
});

/**
 * The console's whole read side, answered by path. Anything unasked-for is a
 * 404 rather than a convenient empty object: a screen reading a shape nobody
 * agreed to send is a test that passes for the wrong reason.
 */
function renderAt(path: string, user: UserDto | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (!user) return unauthorized();
      if (input === "/api/auth/me") return json(user);
      if (input === "/api/projects") return json([CREWBASE]);
      if (input === `/api/projects/${CREWBASE.id}`) return json(CREWBASE);
      if (input === `/api/projects/${CREWBASE.id}/definition/status`) return json({ status: "none" });
      if (input === `/api/projects/${CREWBASE.id}/connection`) return new Response("", { status: 200 });
      if (input === `/api/projects/${CREWBASE.id}/agent-tokens`) return json([]);
      return new Response(JSON.stringify({ error: { code: "not_found", message: "Not found" } }), {
        status: 404,
      });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: { code: "unauthorized", message: "Sign in to continue" } }),
    { status: 401 },
  );
}
