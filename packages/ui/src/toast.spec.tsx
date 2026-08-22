import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toast, ToastViewport } from "./toast";

describe("Toast", () => {
  it("says what happened, and what else there is to say", () => {
    render(<Toast tone="positive" title="Suspend done" onDismiss={vi.fn()} />);

    expect(screen.getByText("Suspend done")).toBeDefined();
  });

  it("carries a description when there is one", () => {
    render(
      <Toast
        tone="critical"
        title="Refund failed"
        description="The application answered 422."
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("The application answered 422.")).toBeDefined();
  });

  /**
   * A failure interrupts, a success does not: `alert` is read out the moment it
   * arrives, and `status` waits for a gap.
   */
  it("announces a failure and mentions a success", () => {
    const { rerender } = render(<Toast tone="critical" title="Refund failed" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeDefined();

    rerender(<Toast tone="positive" title="Refund done" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("wears the tone it was given, out of the badge language's own names", () => {
    render(<Toast tone="positive" title="Suspend done" onDismiss={vi.fn()} />);

    const toast = screen.getByRole("status");
    expect(toast.dataset.tone).toBe("positive");
    expect(toast.className).toContain("bg-positive-soft");
  });

  it("can be dismissed, by a control that says which notice it dismisses", () => {
    const onDismiss = vi.fn();
    render(<Toast tone="positive" title="Suspend done" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Suspend done" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ToastViewport", () => {
  /** A column of notices must not swallow clicks meant for the screen behind it. */
  it("takes no clicks of its own", () => {
    const { container } = render(
      <ToastViewport>
        <Toast tone="positive" title="Suspend done" onDismiss={vi.fn()} />
      </ToastViewport>,
    );

    expect(container.firstElementChild?.className).toContain("pointer-events-none");
    expect(screen.getByRole("status").className).toContain("pointer-events-auto");
  });
});
