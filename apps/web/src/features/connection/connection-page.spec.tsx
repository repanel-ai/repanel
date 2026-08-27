import type { ConnectionDto, ConnectionTestDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ConnectionPage } from "./connection-page";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const DSN = "postgres://admin:hunter2@db.example.com:5432/crewbase";

const CONNECTED: ConnectionDto = { kind: "postgres-direct", host: "db.example.com", database: "crewbase" };

const LIVE: ConnectionDto = {
  kind: "connector",
  connected: true,
  lastSeenAt: "2026-08-27T10:15:00.000Z",
};

const OFFLINE: ConnectionDto = { kind: "connector", connected: false, lastSeenAt: null };

const MINTED = { token: `rpc_${"a".repeat(40)}` };

afterEach(() => vi.unstubAllGlobals());

describe("ConnectionPage", () => {
  it("says a project is pointed at nothing while it is", async () => {
    show(null);

    expect(await screen.findByText("This project is not pointed at a database yet.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
  });

  it("names the database it is pointed at, and never the credential", async () => {
    show(CONNECTED);

    expect(await screen.findByText("db.example.com/crewbase")).toBeDefined();
    expect(document.body.textContent).not.toContain("hunter2");
  });

  it("takes the connection string in a field that does not show it", async () => {
    show(null);

    const field = await screen.findByLabelText("Connection string");

    expect(field.getAttribute("type")).toBe("password");
  });

  it("sends the connection string once, and keeps no copy on the screen", async () => {
    const fetched = show(null);
    fireEvent.change(await screen.findByLabelText("Connection string"), {
      target: { value: DSN },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetched).toHaveBeenCalledWith(
        `/api/projects/${PROJECT_ID}/connection`,
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ dsn: DSN }) }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Connection string")).toHaveProperty("value", ""),
    );
  });

  it("says a working connection worked", async () => {
    show(CONNECTED, { ok: true });

    fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("The database answered.")).toBeDefined();
  });

  it("says each failure in the category it came back as, and in no more detail", async () => {
    const said: Record<string, string> = {
      unreachable: "Nothing answered at that host and port.",
      auth_failed: "The database refused those credentials.",
      timeout: "The database did not answer in time.",
      unknown: "The connection failed, for a reason RePanel could not identify.",
    };

    for (const [reason, sentence] of Object.entries(said)) {
      const view = show(CONNECTED, { ok: false, reason: reason as "unknown" });

      fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));

      expect(await screen.findByText(sentence)).toBeDefined();
      view.unmount();
    }
  });

  describe("the connector rung", () => {
    it("offers it beside the connection string, and says what it changes", async () => {
      show(null);

      expect(await screen.findByRole("button", { name: "Mint a connector token" })).toBeDefined();
      expect(document.body.textContent).toContain("RePanel holds no connection string on this rung");
    });

    it("shows the command once a token is minted, with the token in it", async () => {
      show(null);

      fireEvent.click(await screen.findByRole("button", { name: "Mint a connector token" }));

      expect(await screen.findByText(`npx @repanel/cli connect --token ${MINTED.token}`)).toBeDefined();
      expect(document.body.textContent).toContain("not shown again");
    });

    it("says a connector is there, and when it was last heard from", async () => {
      show(LIVE);

      expect(await screen.findByText("Connected")).toBeDefined();
      expect(screen.getByText(/Last heard from/)).toBeDefined();
    });

    it("says a connector is not there, without pretending to know why", async () => {
      show(OFFLINE);

      expect(await screen.findByText("Offline")).toBeDefined();
      expect(
        await screen.findByText("This project's connector has never connected."),
      ).toBeDefined();
    });

    it("names no host and no database, because RePanel has neither on this rung", async () => {
      show(LIVE);

      await screen.findByText("Connected");
      expect(document.body.textContent).not.toContain("db.example.com");
      expect(screen.queryByLabelText("Connection string")).toBeNull();
    });

    it("shows the command with a placeholder until a token is minted for it", async () => {
      show(LIVE);

      expect(await screen.findByText("npx @repanel/cli connect --token <token>")).toBeDefined();
    });

    it("says plainly that minting again revokes what is running", async () => {
      show(LIVE);

      await screen.findByRole("button", { name: "Mint a new token" });
      expect(document.body.textContent).toContain("revokes the one before it");
    });
  });
});

function show(connection: ConnectionDto | null, verdict?: ConnectionTestDto) {
  // Minting puts the project on the connector rung, so what the API answers
  // with afterwards is a connector connection — as it is in the real one.
  let current = connection;

  const fetched = vi.fn(async (input: string, init?: RequestInit) => {
    if (input.endsWith("/connection/test")) return json(verdict ?? { ok: true });
    if (input.endsWith("/connection/connector")) {
      current = OFFLINE;
      return json(MINTED);
    }
    if (init?.method === "PUT") return json(CONNECTED);
    return current ? json(current) : new Response("", { status: 200 });
  });
  vi.stubGlobal("fetch", fetched);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/p/${PROJECT_ID}/connection`]}>
        <Routes>
          <Route path="/p/:id/connection" element={<ConnectionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return Object.assign(fetched, { unmount: view.unmount });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
