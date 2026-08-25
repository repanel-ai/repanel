import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormSelect, Select } from "./select";

describe("Select", () => {
  it("is named by the label it wears", () => {
    render(
      <Select label="Status" value="active" onChange={() => {}}>
        <option value="active">Active</option>
      </Select>,
    );

    expect(screen.getByLabelText("Status")).toHaveProperty("value", "active");
  });

  it("reports what was chosen", () => {
    const chosen = vi.fn();
    render(
      <Select label="Status" value="" onChange={(event) => chosen(event.target.value)}>
        <option value="">Any</option>
        <option value="suspended">Suspended</option>
      </Select>,
    );

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "suspended" } });

    expect(chosen).toHaveBeenCalledWith("suspended");
  });
});

describe("FormSelect", () => {
  it("offers what it was given, and reports what was chosen", () => {
    const chosen = vi.fn();
    render(
      <FormSelect aria-label="Status" value="draft" onChange={(event) => chosen(event.target.value)}>
        <option value="draft">draft</option>
        <option value="open">open</option>
      </FormSelect>,
    );

    const control = screen.getByLabelText("Status");
    expect([...(control as HTMLSelectElement).options].map((option) => option.value)).toEqual([
      "draft",
      "open",
    ]);

    fireEvent.change(control, { target: { value: "open" } });
    expect(chosen).toHaveBeenCalledWith("open");
  });

  /**
   * A tone is ink here, never a fill: a tinted control the size of a form row
   * is a coloured block on a panel, which is the same thing the notice stopped
   * doing (DECISIONS #052).
   */
  it("says the tone of the value it is showing in the value's own ink", () => {
    render(
      <FormSelect aria-label="Status" tone="critical" value="closed" onChange={() => {}}>
        <option value="closed">closed</option>
      </FormSelect>,
    );

    const control = screen.getByLabelText("Status");
    expect(control.dataset.tone).toBe("critical");
    expect(control.className).toContain("text-destructive-text");
  });

  it("says a value the definition marked nothing about in the ordinary ink", () => {
    render(
      <FormSelect aria-label="Status" value="draft" onChange={() => {}}>
        <option value="draft">draft</option>
      </FormSelect>,
    );

    const control = screen.getByLabelText("Status");
    expect(control.dataset.tone).toBe("neutral");
    expect(control.className).toContain("text-foreground");
  });
});
