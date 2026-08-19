import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTheme } from "./use-theme";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("useTheme", () => {
  it("puts the whole admin in dark, and takes it back out", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("remembers the choice, because it is the operator's and not the session's", () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.toggle());
    first.unmount();

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
  });
});
