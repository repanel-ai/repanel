import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

function ask(props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <Dialog
      open
      title="Suspend"
      confirmLabel="Suspend"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      Suspend this user? They lose access immediately.
    </Dialog>,
  );
  return { onConfirm, onCancel, view };
}

function element(): HTMLDialogElement {
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("nothing rendered a dialog");
  return dialog;
}

describe("Dialog", () => {
  it("opens modally when it is asked to, and shows what it is asking", () => {
    ask();

    expect(element().open).toBe(true);
    expect(screen.getByText("Suspend this user? They lose access immediately.")).toBeDefined();
  });

  it("stays shut until it is asked", () => {
    ask({ open: false });

    expect(element().open).toBe(false);
  });

  it("closes itself when its owner says it is closed", () => {
    const { view } = ask();

    view.rerender(
      <Dialog open={false} title="Suspend" confirmLabel="Suspend" onConfirm={vi.fn()} onCancel={vi.fn()}>
        Suspend this user?
      </Dialog>,
    );

    expect(element().open).toBe(false);
  });

  /** The question names itself, so the modal is announced as what it asks. */
  it("is named by its own title", () => {
    ask();

    expect(screen.getByRole("dialog", { name: "Suspend" })).toBeDefined();
  });

  it("answers with the button that was pressed", () => {
    const { onConfirm, onCancel } = ask();

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("reads escape as a cancel", () => {
    const { onCancel } = ask();

    fireEvent(element(), new Event("cancel", { cancelable: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe("while what it asked about is running", () => {
    it("says so, and takes no second answer", () => {
      const { onConfirm, onCancel } = ask({ pending: "Suspending…" });

      expect(screen.getByRole("status").textContent).toBe("Suspending…");
      fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    /** There is nothing left to cancel: the request is already out. */
    it("does not let escape cancel it either", () => {
      const { onCancel } = ask({ pending: "Suspending…" });

      fireEvent(element(), new Event("cancel", { cancelable: true }));

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it("says nothing about running when nothing is", () => {
    ask();

    expect(screen.queryByRole("status")).toBeNull();
  });
});
