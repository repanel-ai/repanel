import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormError } from "./form-error";

describe("FormError", () => {
  it("announces the message it is given", () => {
    render(<FormError message="Email or password is incorrect." />);

    expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect.");
  });

  it("renders nothing when there is nothing wrong", () => {
    render(<FormError message={null} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
