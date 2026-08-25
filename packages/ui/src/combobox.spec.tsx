import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption, type ComboboxProps } from "./combobox";

const ACME: ComboboxOption = { id: "org-1", label: "Acme" };
const BETA: ComboboxOption = { id: "org-2", label: "Beta" };

function open(props: Partial<ComboboxProps> = {}) {
  const onQueryChange = vi.fn();
  const onSelect = vi.fn();
  render(
    <Combobox
      query=""
      onQueryChange={onQueryChange}
      options={[ACME, BETA]}
      value={null}
      onSelect={onSelect}
      {...props}
    />,
  );
  const box = screen.getByRole("combobox");
  return { box, onQueryChange, onSelect };
}

describe("Combobox", () => {
  it("shows what is in the box", () => {
    const { box } = open({ query: "ac" });

    expect((box as HTMLInputElement).value).toBe("ac");
    expect(box.getAttribute("aria-expanded")).toBe("false");
  });

  it("offers the records it was given the moment somebody types", () => {
    const { box, onQueryChange } = open();

    fireEvent.change(box, { target: { value: "ac" } });

    expect(onQueryChange).toHaveBeenCalledWith("ac");
    expect(box.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("option", { name: "Acme" })).toBeDefined();
  });

  it("chooses the record that was pressed, and closes over it", () => {
    const { box, onSelect } = open();

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));

    expect(onSelect).toHaveBeenCalledWith(BETA);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("walks the list with the arrows and takes the one enter lands on", () => {
    const { box, onSelect } = open();

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(BETA);
  });

  /** The form around it is not being submitted; a record is being chosen. */
  it("keeps enter to itself while the list is open", () => {
    const { box } = open();

    fireEvent.keyDown(box, { key: "ArrowDown" });
    const delivered = fireEvent.keyDown(box, { key: "Enter" });

    expect(delivered).toBe(false);
  });

  it("lets enter through when there is no list to choose from", () => {
    const { box } = open();

    expect(fireEvent.keyDown(box, { key: "Enter" })).toBe(true);
  });

  it("puts back what is chosen when the box is closed with escape", () => {
    const { box, onQueryChange, onSelect } = open({ query: "bet", value: ACME });

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Escape" });

    expect(onQueryChange).toHaveBeenCalledWith("Acme");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("says which record is the chosen one", () => {
    const { box } = open({ value: BETA });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(screen.getByRole("option", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "Acme" }).getAttribute("aria-selected")).toBe("false");
  });

  /** The row an operator is on and the row the field holds are two different
   *  facts, and the list has to show both at once. */
  it("marks the chosen row for the eye as well as for a reader", () => {
    const { box } = open({ value: BETA });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    const chosen = screen.getByRole("option", { name: "Beta" });
    expect(chosen.querySelector("[data-slot='chosen']")).not.toBeNull();
    expect(
      screen.getByRole("option", { name: "Acme" }).querySelector("[data-slot='chosen']"),
    ).toBeNull();
  });

  it("shows a record that has no name by the key it has", () => {
    const { box } = open({ options: [{ id: "org-3", label: null }] });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(screen.getByRole("option", { name: "org-3" })).toBeDefined();
  });

  it("says when nothing matched rather than showing an empty list", () => {
    const { box } = open({ options: [], query: "zz" });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(screen.getByText("No matches")).toBeDefined();
  });

  it("says it is still asking rather than that there is nothing", () => {
    const { box } = open({ options: [], query: "zz", loading: true });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(screen.getByText("Searching…")).toBeDefined();
    expect(screen.queryByText("No matches")).toBeNull();
  });

  it("carries a note under the list where there is something to say", () => {
    const { box } = open({ note: "The first 20 matches. Keep typing to narrow them." });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(screen.getByText("The first 20 matches. Keep typing to narrow them.")).toBeDefined();
  });

  it("offers to take the value away where it may be taken away", () => {
    const onClear = vi.fn();
    const { box } = open({ value: ACME, onClear });

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Any" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("offers nothing of the kind where the value must be answered", () => {
    const { box } = open({ value: ACME });

    fireEvent.keyDown(box, { key: "ArrowDown" });

    expect(screen.queryByRole("option", { name: "Any" })).toBeNull();
  });

  /** A filter says what it answers inside its own box; a form row says it above. */
  it("wears its own label where it is asked to", () => {
    open({ label: "Airline" });

    expect(screen.getByRole("combobox", { name: /Airline/ })).toBeDefined();
  });

  it("takes the wiring a form row hands it", () => {
    open({ id: "field-1", required: true, "aria-describedby": "field-1-problem" });

    const box = screen.getByRole("combobox");
    expect(box.id).toBe("field-1");
    expect(box.getAttribute("aria-required")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe("field-1-problem");
  });
});
