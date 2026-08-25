import type { DefinitionStatusDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { DefinitionPage } from "./definition-page";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const RUNTIME_URL = "https://admin.repanel.test";

const MISSING_NAVIGATION = {
  path: "navigation",
  message: "Required key `navigation` is missing.",
  expected: "an array of navigation groups",
  hint: 'Add `navigation: [{ label: "Data", resources: ["airlines"] }]`.',
};

const NOTHING: DefinitionStatusDto = {
  draft: { status: "none" },
  published: null,
  unpublishedChanges: false,
};

/** A valid draft nobody has published: the state a held submission leaves. */
const UNPUBLISHED: DefinitionStatusDto = {
  draft: { status: "valid", updatedAt: "2026-08-19T09:30:00.000Z" },
  published: null,
  unpublishedChanges: true,
};

/** A definition that was submitted and published in the same breath. */
const LIVE: DefinitionStatusDto = {
  draft: { status: "valid", updatedAt: "2026-08-19T09:30:00.000Z" },
  published: { version: 3, publishedAt: "2026-08-19T09:31:00.000Z" },
  unpublishedChanges: false,
};

/** The transcript's own state: a failing draft over an admin that is up. */
const BROKEN_OVER_LIVE: DefinitionStatusDto = {
  draft: { status: "invalid", errorCount: 1, errors: [MISSING_NAVIGATION] },
  published: { version: 3, publishedAt: "2026-08-19T09:31:00.000Z" },
  unpublishedChanges: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("DefinitionPage", () => {
  it("sells the loop when nothing has been submitted", async () => {
    show(NOTHING);

    expect(await screen.findByText("No definition yet")).toBeDefined();
    expect(screen.getByText(/ask it to create your admin/)).toBeDefined();
    expect(screen.queryByRole("link", { name: "Open admin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish draft" })).toBeNull();
  });

  /**
   * The two teaching states are different states: one project is waiting on its
   * agent, the other on the human reading this. Saying the same thing to both
   * would send one of them somewhere useless.
   */
  it("tells a draft waiting to be published apart from no definition at all", async () => {
    show(UNPUBLISHED);

    expect(await screen.findByText("Nothing published yet")).toBeDefined();
    expect(screen.queryByText("No definition yet")).toBeNull();
    expect(screen.getByRole("button", { name: "Publish draft" }).hasAttribute("disabled")).toBe(
      false,
    );
    // Nothing is live, so there is nothing to open.
    expect(screen.queryByRole("link", { name: "Open admin" })).toBeNull();
  });

  it("offers the admin itself once a version is live, at the runtime's own origin", async () => {
    show(LIVE);

    const open = await screen.findByRole("link", { name: "Open admin" });

    expect(open.getAttribute("href")).toBe(`${RUNTIME_URL}/a/crewbase-a3k9x2`);
    expect(screen.getByText("Version 3")).toBeDefined();
    expect(screen.getByText(/Published 19 Aug 2026 09:31 UTC/)).toBeDefined();
  });

  it("says nothing is new to publish when the draft is the version being served", async () => {
    show(LIVE);

    const publish = await screen.findByRole("button", { name: "Publish draft" });

    expect(publish.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Nothing new to publish/)).toBeDefined();
  });

  it("says when the agent has submitted something newer than what is live", async () => {
    show({ ...LIVE, unpublishedChanges: true });

    expect(await screen.findByText(/newer draft since/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Publish draft" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("renders every problem with its path, its message and its hint", async () => {
    show(BROKEN_OVER_LIVE);

    expect(await screen.findByText("navigation")).toBeDefined();
    expect(screen.getByText("Required key `navigation` is missing.")).toBeDefined();
    // The hint is the payoff of the error design, and it is for the human too.
    expect(screen.getByText(MISSING_NAVIGATION.hint)).toBeDefined();
  });

  it("says nothing is lost while a definition is invalid", async () => {
    show(BROKEN_OVER_LIVE);

    expect(await screen.findByText(/stored as it was sent, so nothing is lost/)).toBeDefined();
  });

  /** The whole point of the split, said on the page the human is looking at. */
  it("keeps the live version on screen while the draft over it is broken", async () => {
    show(BROKEN_OVER_LIVE);

    expect(await screen.findByText("Version 3")).toBeDefined();
    expect(screen.getByRole("link", { name: "Open admin" })).toBeDefined();
  });

  it("refuses to publish an invalid draft, and says why rather than hiding the button", async () => {
    show(BROKEN_OVER_LIVE);

    const publish = await screen.findByRole("button", { name: "Publish draft" });

    expect(publish.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Publishing needs a draft that validates — 1 problem below/)).toBeDefined();
  });

  it("publishes the draft once, on the human's word", async () => {
    const fetched = show(UNPUBLISHED);

    fireEvent.click(await screen.findByRole("button", { name: "Publish draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(fetched).toHaveBeenCalledWith(
        `/api/projects/${PROJECT_ID}/definition/publish`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("asks before publishing, because everyone using the admin sees it", async () => {
    show(UNPUBLISHED);

    fireEvent.click(await screen.findByRole("button", { name: "Publish draft" }));

    expect(screen.getByText(/sees this definition as soon as you publish/)).toBeDefined();
  });

  it("says a refused publication beside the control that asked for it", async () => {
    show(UNPUBLISHED, {
      publish: () =>
        new Response(
          JSON.stringify({ error: { code: "validation_failed", message: "This definition has not validated" } }),
          { status: 422 },
        ),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Publish draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "This definition has not validated",
    );
  });
});

interface Answers {
  /** What the publish endpoint answers; the version, by default. */
  publish?: () => Response;
}

function show(status: DefinitionStatusDto, answers: Answers = {}) {
  // The page reads the project for the key its admin is addressed by, and the
  // status for everything else.
  const fetched = vi.fn(async (input: string, init?: RequestInit) => {
    if (input.endsWith("/definition/publish")) {
      return answers.publish?.() ?? json({ version: 4, publishedAt: "2026-08-19T10:00:00.000Z" });
    }
    if (input.endsWith("/definition/status")) return json(status);
    return json({
      id: PROJECT_ID,
      name: "Crewbase",
      key: "crewbase-a3k9x2",
      createdAt: "2026-08-18T12:00:00.000Z",
    });
  });
  vi.stubGlobal("fetch", fetched);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/p/${PROJECT_ID}/definition`]}>
        <Routes>
          <Route path="/p/:id/definition" element={<DefinitionPage runtimeUrl={RUNTIME_URL} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return fetched;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
