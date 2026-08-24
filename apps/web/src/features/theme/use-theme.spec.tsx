import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./use-theme";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme-switching");
  vi.unstubAllGlobals();
});

describe("useTheme", () => {
  it("opens light, whatever the machine prefers — light is the entry theme", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("puts the console in dark, and takes it back out", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("remembers the choice under the key the pre-paint script reads", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());

    expect(window.localStorage.getItem("repanel.theme")).toBe("dark");
  });

  it("does not arm the crossfade on the first render — mounting is not a switch", () => {
    renderHook(() => useTheme());

    expect(document.documentElement.hasAttribute("data-theme-switching")).toBe(false);
  });

  it("marks the document while the colours cross, and takes the mark off after", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTheme());

      act(() => result.current.toggle());
      expect(document.documentElement.hasAttribute("data-theme-switching")).toBe(true);

      act(() => vi.advanceTimersByTime(120));
      expect(document.documentElement.hasAttribute("data-theme-switching")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
