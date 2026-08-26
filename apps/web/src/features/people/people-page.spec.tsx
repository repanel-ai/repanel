import type { AddedPersonDto, PersonDto } from "@repanel/contracts";
import { Toaster } from "@repanel/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PeoplePage } from "./people-page";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const ADA: PersonDto = {
  userId: "u_1",
  email: "ada@example.com",
  name: "Ada",
  role: "owner",
  addedAt: "2026-08-18T12:00:00.000Z",
};

const RAVI: PersonDto = {
  userId: "u_2",
  email: "ravi@example.com",
  name: "Ravi",
  role: "operator",
  addedAt: "2026-08-26T09:00:00.000Z",
};

const PASSWORD = "Nq2Xr7fL8kPa1ZbYc3Dm";

afterEach(() => vi.unstubAllGlobals());

describe("PeoplePage", () => {
  it("lists who is on the project, and offers to revoke only the operators", async () => {
    show({ people: [ADA, RAVI] });

    expect(await screen.findByText("Ravi")).toBeDefined();
    expect(screen.getByText("Owner")).toBeDefined();
    expect(screen.getByText("Operator")).toBeDefined();
    // One control for one operator: the owner's row has none, because a project
    // with nobody who can configure it is a project nobody can fix.
    expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(1);
  });

  it("shows a new operator's password once, and says what to do when it is lost", async () => {
    show({ people: [ADA], added: { person: RAVI, password: PASSWORD } });

    await addOperator();

    expect(await screen.findByText(PASSWORD)).toBeDefined();
    expect(screen.getByText(/you will not see it again/)).toBeDefined();
    expect(screen.getByText(/revoke them and add them again/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "I have copied it" }));
    expect(screen.queryByText(PASSWORD)).toBeNull();
  });

  it("says plainly what an operator cannot do, beside the control that adds one", async () => {
    show({ people: [ADA] });

    expect(
      await screen.findByText(/cannot open the console, mint agent tokens/),
    ).toBeDefined();
  });

  it("shows no password for somebody who already had a RePanel account", async () => {
    show({ people: [ADA], added: { person: RAVI, password: null } });

    await addOperator();

    expect(await screen.findByText("ravi@example.com can use this admin")).toBeDefined();
    expect(screen.queryByText(/you will not see it again/)).toBeNull();
  });

  it("asks before revoking, and says what revoking does", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    show({ people: [ADA, RAVI], record: calls });

    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/lose this admin on their next request/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    expect(await screen.findByText("ravi@example.com can no longer use this admin")).toBeDefined();
    expect(calls).toContainEqual({
      url: `/api/projects/${PROJECT_ID}/people/${RAVI.userId}`,
      method: "DELETE",
    });
  });

  it("says what went wrong instead of pretending somebody was added", async () => {
    show({ people: [ADA], failure: "They are already on this project" });

    await addOperator();

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "They are already on this project",
    );
  });
});

async function addOperator() {
  fireEvent.change(await screen.findByLabelText("Add an operator"), {
    target: { value: "ravi@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Their name"), { target: { value: "Ravi" } });
  fireEvent.click(screen.getByRole("button", { name: "Add operator" }));
}

function show(facts: {
  people: PersonDto[];
  added?: AddedPersonDto;
  failure?: string;
  record?: Array<{ url: string; method: string }>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      facts.record?.push({ url: input, method: init?.method ?? "GET" });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (init?.method === "POST") {
        return facts.failure
          ? new Response(JSON.stringify({ error: { code: "conflict", message: facts.failure } }), {
              status: 409,
            })
          : new Response(JSON.stringify(facts.added), { status: 200 });
      }
      return new Response(JSON.stringify(facts.people), { status: 200 });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster>
        <MemoryRouter initialEntries={[`/p/${PROJECT_ID}/people`]}>
          <Routes>
            <Route path="/p/:id/people" element={<PeoplePage />} />
          </Routes>
        </MemoryRouter>
      </Toaster>
    </QueryClientProvider>,
  );
}
