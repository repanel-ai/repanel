import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminDefinition } from "./definition.fixture";
import { runtimeKeys, useDefinition, useRecords } from "./use-runtime";

afterEach(() => vi.unstubAllGlobals());

describe("runtimeKeys", () => {
  it("asks a different question once a filter changes", () => {
    const unfiltered = runtimeKeys.records("acme", "users", "");
    const filtered = runtimeKeys.records("acme", "users", "filter[status]=active");

    expect(filtered).not.toEqual(unfiltered);
  });

  it("keeps one project's records out of another's", () => {
    expect(runtimeKeys.records("acme", "users", "")).not.toEqual(
      runtimeKeys.records("other", "users", ""),
    );
  });
});

describe("useDefinition", () => {
  it("reads the admin the project publishes", async () => {
    const fetched = stubFetch(adminDefinition);
    const { result } = renderHook(() => useDefinition("acme"), { wrapper });

    await waitFor(() => expect(result.current.data?.app.name).toBe("Acme Admin"));
    expect(fetched()).toBe("/api/runtime/acme/definition");
  });
});

describe("useRecords", () => {
  it("asks for exactly the page the address describes", async () => {
    const fetched = stubFetch({ records: [], total: 0, page: 2, pageSize: 25 });
    const { result } = renderHook(() => useRecords("acme", "users", "page=2&search=ada"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetched()).toBe("/api/runtime/acme/resources/users/records?page=2&search=ada");
  });

  it("asks a plain question when nothing narrows the table", async () => {
    const fetched = stubFetch({ records: [], total: 0, page: 1, pageSize: 25 });
    const { result } = renderHook(() => useRecords("acme", "users", ""), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetched()).toBe("/api/runtime/acme/resources/users/records");
  });
});

/** Stubs the network and answers with `body`; returns the path that was asked for. */
function stubFetch(body: unknown): () => string {
  const asked: string[] = [];
  const fetch = vi.fn(async (input: unknown) => {
    asked.push(String(input));
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return () => asked[0] ?? "";
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
