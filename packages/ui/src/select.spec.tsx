import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

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
