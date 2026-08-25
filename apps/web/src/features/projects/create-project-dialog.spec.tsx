import type { ProjectDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@repanel/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateProjectDialog } from "./create-project-dialog";

const CREWBASE: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("CreateProjectDialog", () => {
  it("asks for the one thing creating a project needs", () => {
    open();

    expect(screen.getByText("New project")).toBeDefined();
    expect(screen.getByLabelText("Name")).toBeDefined();
  });

  it("creates the project under the name it was given", async () => {
    const fetched = open();

    name("Crewbase");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(fetched).toHaveBeenCalledWith("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Crewbase" }),
      }),
    );
  });

  it("shows the new project, which is where its key and its setup are", async () => {
    open();

    name("Crewbase");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText(`project ${CREWBASE.id}`)).toBeDefined();
  });

  /**
   * The dialog is closed and the browser is on another page by the time this
   * is known, so the account of it cannot live on the screen that asked.
   */
  it("says the project was created, on the page creating it landed on", async () => {
    open();

    name("Crewbase");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await screen.findByText(`project ${CREWBASE.id}`);
    expect(screen.getByText("Crewbase created")).toBeDefined();
  });

  it("says what the API refused, and stays open to be corrected", async () => {
    open(
      new Response(
        JSON.stringify({ error: { code: "validation_failed", message: "name must not be empty" } }),
        { status: 422 },
      ),
    );

    name("   ");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "name must not be empty",
    );
    expect(screen.getByLabelText("Name")).toBeDefined();
  });
});

function name(value: string) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value } });
}

function open(answer?: Response) {
  const fetched = vi.fn(
    async () => answer ?? new Response(JSON.stringify(CREWBASE), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetched);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Toaster>
          <Routes>
            <Route path="/" element={<CreateProjectDialog open onClose={() => undefined} />} />
            {/* Where creating one lands: the page that has its key and its setup. */}
            <Route path="/p/:id" element={<Landed />} />
          </Routes>
        </Toaster>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetched;
}

/** Stands in for the project page, so the navigation is what is asserted. */
function Landed() {
  return <p>project {CREWBASE.id}</p>;
}
