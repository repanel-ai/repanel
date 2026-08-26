import type { DefinitionStatusDto, ProjectDto, UserDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

/** A project nothing has been submitted to, as the API answers it. */
const NO_DEFINITION: DefinitionStatusDto = {
  draft: { status: "none" },
  published: null,
  unpublishedChanges: false,
};


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

  it("opens a project on where it stands, and names its five pages", async () => {
    renderAt(`/p/${CREWBASE.id}`, ADA);

    // `/p/:id` is not a page: it is the way in, and where a project stands is
    // the only screen that says what is left to do.
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();

    const nav = screen.getByRole("navigation", { name: "Project" });
    for (const page of ["Overview", "Connection", "Agent access", "Definition", "People"]) {
      expect(within(nav).getByText(page)).toBeDefined();
    }
    // Which project, said once, where the runtime says which app.
    expect(screen.getAllByText("crewbase-a3k9x2").length).toBeGreaterThan(0);
  });

  it("comes back to the address a visitor was sent to once they have signed in", async () => {
    // `repanel link` hands out this address, and an agent hands out a
    // project's. A sign-in that dropped what it was carrying would strand both.
    let signedIn = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/auth/login") {
          signedIn = true;
          return Promise.resolve(json(ADA));
        }
        if (input === "/api/auth/me") return Promise.resolve(signedIn ? json(ADA) : unauthorized());
        return Promise.resolve(unauthorized());
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/cli?port=54321&state=s-1"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Authorize the RePanel CLI" }),
    ).toBeDefined();
  });

  it("gives each of the five pages its own address", async () => {
    for (const [path, heading] of [
      ["connection", "Connection"],
      ["agents", "Agent access"],
      ["definition", "Definition"],
      ["people", "People"],
    ]) {
      const view = renderAt(`/p/${CREWBASE.id}/${path}`, ADA);

      expect(await screen.findByRole("heading", { name: heading })).toBeDefined();
      view.unmount();
    }
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
      if (input === "/api/projects") return json([{ project: CREWBASE, role: "owner" }]);
      if (input === `/api/projects/${CREWBASE.id}`) return json(CREWBASE);
      if (input === `/api/projects/${CREWBASE.id}/definition/status`) return json(NO_DEFINITION);
      if (input === `/api/projects/${CREWBASE.id}/connection`) return new Response("", { status: 200 });
      if (input === `/api/projects/${CREWBASE.id}/agent-tokens`) return json([]);
      if (input === `/api/projects/${CREWBASE.id}/people`) {
        return json([{ userId: ADA.id, email: ADA.email, name: ADA.name, role: "owner", addedAt: "2026-08-18T12:00:00.000Z" }]);
      }
      return new Response(JSON.stringify({ error: { code: "not_found", message: "Not found" } }), {
        status: 404,
      });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
