import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelationPicker, type RelationPickerProps } from "./relation-picker";

afterEach(() => vi.unstubAllGlobals());

const AIRLINES = [
  { id: "air-1", label: "Northwind" },
  { id: "air-2", label: "Kestrel" },
];

/** Stubs the network; returns every path that was asked for. */
function stubFetch(body: unknown = AIRLINES): () => string[] {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      asked.push(String(input));
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return () => asked;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function pick(props: Partial<RelationPickerProps> = {}) {
  const onChange = vi.fn();
  const view = render(
    <RelationPicker
      projectKey="acme"
      target="airlines"
      value={null}
      onChange={onChange}
      {...props}
    />,
    { wrapper },
  );
  return { onChange, view, box: screen.getByRole("combobox") };
}

describe("RelationPicker", () => {
  it("offers the records the resource on the other side answers with", async () => {
    const asked = stubFetch();
    const { box } = pick();

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Northwind" })).toBeDefined();
    expect(asked()).toEqual(["/api/runtime/acme/resources/airlines/options"]);
  });

  it("asks nothing at all until it is opened", () => {
    const asked = stubFetch();
    pick();

    expect(asked()).toEqual([]);
  });

  it("writes the key and shows the name", async () => {
    stubFetch();
    const { box, onChange } = pick();

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Kestrel" }));

    expect(onChange).toHaveBeenCalledWith("air-2");
    expect((box as HTMLInputElement).value).toBe("Kestrel");
  });

  /** The record came with a label; the key on its own says nothing. */
  it("opens on the name of the record it already points at", () => {
    stubFetch();
    pick({ value: "air-1", valueLabel: "Northwind" });

    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Northwind");
  });

  it("shows the key itself where nothing has named it", () => {
    stubFetch();
    pick({ value: "air-9" });

    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("air-9");
  });

  it("offers the key that was typed where no record was found under it", async () => {
    stubFetch([]);
    const { box, onChange } = pick();

    fireEvent.change(box, { target: { value: "air-9" } });
    fireEvent.click(await screen.findByRole("option", { name: "Use key air-9" }));

    expect(onChange).toHaveBeenCalledWith("air-9");
  });

  it("offers no such row for a record it did find", async () => {
    stubFetch([{ id: "air-1", label: "Northwind" }]);
    const { box } = pick();

    fireEvent.change(box, { target: { value: "air-1" } });

    await screen.findByRole("option", { name: "Northwind" });
    expect(screen.queryByRole("option", { name: /Use key/ })).toBeNull();
  });

  /**
   * Opening a picker is asking what else there is. The box still shows the
   * record it points at — selected, so one keystroke replaces it — and the list
   * under it is everything, not the one record whose name is already in the box.
   */
  it("asks for the whole list when it is opened on a record it already points at", async () => {
    const asked = stubFetch();
    const { box } = pick({ value: "air-1", valueLabel: "Northwind" });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    await screen.findByRole("option", { name: "Kestrel" });
    expect(asked()).toEqual(["/api/runtime/acme/resources/airlines/options"]);
  });

  it("offers no key row for the name that is already in the box", async () => {
    stubFetch();
    const { box } = pick({ value: "air-1", valueLabel: "Northwind" });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    await screen.findByRole("option", { name: "Northwind" });
    expect(screen.queryByRole("option", { name: /Use key/ })).toBeNull();
  });

  /** A search that is still matching something is a search, not a key. */
  it("offers no key row while what was typed is still finding records", async () => {
    stubFetch();
    const { box } = pick();

    fireEvent.change(box, { target: { value: "nor" } });

    await screen.findByRole("option", { name: "Northwind" });
    expect(screen.queryByRole("option", { name: /Use key/ })).toBeNull();
  });

  it("takes the value away where nothing is a legal answer", async () => {
    stubFetch();
    const { box, onChange } = pick({ clearable: true, value: "air-1", valueLabel: "Northwind" });

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Any" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  /** `Clear all` speaks for every filter at once, and this one has to follow. */
  it("follows the value when it is taken away from outside", () => {
    stubFetch();
    const { view } = pick({ clearable: true, value: "air-1", valueLabel: "Northwind" });

    view.rerender(
      <RelationPicker
        projectKey="acme"
        target="airlines"
        value={null}
        clearable
        onChange={vi.fn()}
      />,
    );

    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("");
  });

  it("says how many it is showing when there are more than it can", async () => {
    stubFetch(Array.from({ length: 20 }, (_, at) => ({ id: `air-${at}`, label: `Airline ${at}` })));
    const { box } = pick();

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(await screen.findByText(/first 20/i)).toBeDefined();
  });

  it("waits for the typing to stop before asking again", async () => {
    const asked = stubFetch();
    const { box } = pick();

    fireEvent.keyDown(box, { key: "ArrowDown" });
    await screen.findByRole("option", { name: "Northwind" });

    fireEvent.change(box, { target: { value: "n" } });
    fireEvent.change(box, { target: { value: "no" } });
    fireEvent.change(box, { target: { value: "nor" } });

    await waitFor(() =>
      expect(asked()).toEqual([
        "/api/runtime/acme/resources/airlines/options",
        "/api/runtime/acme/resources/airlines/options?q=nor",
      ]),
    );
  });
});
