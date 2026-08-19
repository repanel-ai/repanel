import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangeFilter } from "./date-range-filter";

function renderFilter(value?: { from?: string; to?: string }) {
  const onChange = vi.fn();
  render(<DateRangeFilter label="Created" value={value} onChange={onChange} hasTime={false} />);
  return onChange;
}

describe("DateRangeFilter", () => {
  /**
   * The picker, the keyboard and the parsing belong to the browser. Replacing
   * them would mean owning a calendar, and the one underneath is already
   * better than the one this would grow.
   */
  it("keeps the browser's own date control underneath", () => {
    renderFilter();

    expect(screen.getByLabelText("From").getAttribute("type")).toBe("date");
  });

  it("stays quiet until a day is picked, then comes forward", () => {
    renderFilter({ from: "2026-07-01" });

    expect(screen.getByLabelText("From").className).toContain("text-foreground");
    expect(screen.getByLabelText("To").className).toContain("text-muted-foreground");
  });

  it("sets both ends of the range in the data face", () => {
    renderFilter();

    for (const end of ["From", "To"]) expect(screen.getByLabelText(end).className).toContain("font-data");
  });

  it("hands the day back to whoever owns the filter", () => {
    const onChange = renderFilter();

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-07-01" } });

    expect(onChange).toHaveBeenCalledWith({ from: "2026-07-01" });
  });
});
