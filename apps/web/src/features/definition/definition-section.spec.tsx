import type { DefinitionStatusDto } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DefinitionSection } from "./definition-section";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const RUNTIME_URL = "https://admin.repanel.test";

const MISSING_NAVIGATION = {
  path: "navigation",
  message: "Required key `navigation` is missing.",
  expected: "an array of navigation groups",
  hint: 'Add `navigation: [{ label: "Data", resources: ["airlines"] }]`.',
};

afterEach(() => vi.unstubAllGlobals());

describe("DefinitionSection", () => {
  it("sells the loop when nothing has been submitted", async () => {
    show({ status: "none" });

    expect(await screen.findByText("No definition yet")).toBeDefined();
    expect(screen.getByText(/ask it to create your admin/)).toBeDefined();
    expect(screen.queryByRole("link", { name: "Open admin" })).toBeNull();
  });

  it("renders every problem with its path, its message and its hint", async () => {
    show({ status: "invalid", errorCount: 1, errors: [MISSING_NAVIGATION] });

    expect(await screen.findByText("navigation")).toBeDefined();
    expect(screen.getByText("Required key `navigation` is missing.")).toBeDefined();
    // The hint is the payoff of the error design, and it is for the human too.
    expect(screen.getByText(MISSING_NAVIGATION.hint)).toBeDefined();
  });

  it("says nothing is lost while a definition is invalid", async () => {
    show({ status: "invalid", errorCount: 1, errors: [MISSING_NAVIGATION] });

    expect(await screen.findByText(/stored as it was sent, so nothing is lost/)).toBeDefined();
  });

  it("offers the admin itself once the definition is valid, at the runtime's own origin", async () => {
    show({ status: "valid", updatedAt: "2026-08-19T09:30:00.000Z" });

    const open = await screen.findByRole("link", { name: "Open admin" });

    expect(open.getAttribute("href")).toBe(`${RUNTIME_URL}/a/crewbase-a3k9x2`);
    expect(screen.getByText("Submitted 19 Aug 2026 09:30 UTC")).toBeDefined();
  });
});

function show(status: DefinitionStatusDto) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })));

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DefinitionSection
        projectId={PROJECT_ID}
        projectKey="crewbase-a3k9x2"
        runtimeUrl={RUNTIME_URL}
      />
    </QueryClientProvider>,
  );
}
