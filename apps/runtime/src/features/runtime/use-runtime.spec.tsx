import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminDefinition } from "./definition.fixture";
import { runtimeKeys, useDefinition, useRecords, useRunAction } from "./use-runtime";

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

  /** One key reaches every question a table has been asked, which is what lets
   *  a write put the whole of a resource's list out of date at once. */
  it("files every page of a list under the resource it belongs to", () => {
    const resource = runtimeKeys.resourceRecords("acme", "users");

    for (const query of ["", "page=2", "filter[status]=active"]) {
      expect(runtimeKeys.records("acme", "users", query).slice(0, resource.length)).toEqual([
        ...resource,
      ]);
    }
    expect(runtimeKeys.resourceRecords("acme", "orders")).not.toEqual(resource);
  });

  /** A related list is filed under its record, so one key covers both. */
  it("files a related list under the record it hangs off", () => {
    const record = runtimeKeys.record("acme", "users", "u_1");

    expect(runtimeKeys.related("acme", "users", "u_1", "orders", "").slice(0, record.length)).toEqual([
      ...record,
    ]);
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

describe("useRunAction", () => {
  const RECORD = runtimeKeys.record("acme", "users", "u_1");
  const RELATED = runtimeKeys.related("acme", "users", "u_1", "orders", "");
  const UNFILTERED = runtimeKeys.records("acme", "users", "");
  const FILTERED = runtimeKeys.records("acme", "users", "filter[status]=active");
  const OTHER_RESOURCE = runtimeKeys.records("acme", "orders", "");
  const OTHER_PROJECT = runtimeKeys.records("other", "users", "");

  /** A client holding one of everything an action could put out of date. */
  function primed() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (const key of [RECORD, RELATED, UNFILTERED, FILTERED, OTHER_RESOURCE, OTHER_PROJECT]) {
      client.setQueryData(key, { primed: true });
    }
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated === true;
    return { client, Wrapper, stale };
  }

  async function run(Wrapper: (props: { children: ReactNode }) => ReactNode, actionKey = "suspend") {
    const { result } = renderHook(() => useRunAction("acme", "users", "u_1"), { wrapper: Wrapper });
    await act(async () => {
      result.current.mutate(actionKey);
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    return result;
  }

  it("posts to the action the definition named, on the record it is about", async () => {
    const asked = stubCalls({ ok: true, label: "Suspend" });
    const { Wrapper } = primed();

    await run(Wrapper);

    expect(asked()).toEqual([
      ["POST", "/api/runtime/acme/resources/users/records/u_1/actions/suspend"],
    ]);
  });

  /**
   * An action is read in two places: the record it ran on, and the table that
   * lists it. Both show the field it changed, so both are put out of date.
   */
  it("puts the record, its related lists and every page of the table out of date", async () => {
    stubCalls({ ok: true, label: "Suspend" });
    const { Wrapper, stale } = primed();

    await run(Wrapper);

    expect(stale(RECORD)).toBe(true);
    expect(stale(RELATED)).toBe(true);
    expect(stale(UNFILTERED)).toBe(true);
    expect(stale(FILTERED)).toBe(true);
  });

  it("leaves alone what the action cannot have changed", async () => {
    stubCalls({ ok: true, label: "Suspend" });
    const { Wrapper, stale } = primed();

    await run(Wrapper);

    expect(stale(OTHER_RESOURCE)).toBe(false);
    expect(stale(OTHER_PROJECT)).toBe(false);
  });

  it("puts nothing out of date when the action did not run", async () => {
    stubCalls(
      { error: { code: "action_rejected", message: "The application answered 500." } },
      502,
    );
    const { Wrapper, stale } = primed();

    const result = await run(Wrapper);

    expect(result.current.isError).toBe(true);
    for (const key of [RECORD, RELATED, UNFILTERED, FILTERED]) expect(stale(key)).toBe(false);
  });
});

/** Stubs the network and answers with `body`; returns method and path per call. */
function stubCalls(body: unknown, status = 200): () => Array<[string, string]> {
  const calls: Array<[string, string]> = [];
  const fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push([String(init?.method ?? "GET"), String(input)]);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fetch);
  return () => calls;
}

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
