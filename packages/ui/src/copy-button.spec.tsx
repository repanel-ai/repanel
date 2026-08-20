import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";

afterEach(() => vi.unstubAllGlobals());

function stubClipboard(writeText = vi.fn(async () => {})) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  return writeText;
}

describe("CopyButton", () => {
  it("is named by both the value it shows and what pressing it does", () => {
    stubClipboard();
    render(
      <CopyButton value="u_1" what="the user id">
        u_1
      </CopyButton>,
    );

    expect(screen.getByRole("button", { name: "u_1, copy the user id" })).toBeDefined();
  });

  it("puts the value on the clipboard and says it did", async () => {
    const writeText = stubClipboard();
    render(
      <CopyButton value="u_1" what="the user id">
        u_1
      </CopyButton>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith("u_1");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied the user id"));
  });

  /**
   * A clipboard the browser will not hand over is not a reason to break the
   * page: the value is on screen and selectable either way.
   */
  it("stays standing when the browser refuses the clipboard", async () => {
    stubClipboard(vi.fn(async () => Promise.reject(new Error("denied"))));
    render(
      <CopyButton value="u_1" what="the user id">
        u_1
      </CopyButton>,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(""));
    expect(screen.getByText("u_1")).toBeDefined();
  });
});
