import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster, useToaster, type ToastMessage } from "./toast";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Raises the notices a spec hands it, in order, on one press. */
function Raise({ notices }: { notices: readonly ToastMessage[] }) {
  const { notify } = useToaster();
  return (
    <button type="button" onClick={() => notices.forEach((notice) => notify(notice))}>
      raise
    </button>
  );
}

function raise(...notices: readonly ToastMessage[]): void {
  render(
    <Toaster>
      <Raise notices={notices} />
    </Toaster>,
  );
  fireEvent.click(screen.getByRole("button", { name: "raise" }));
}

/** Every notice on screen, topmost first. */
function titles(): (string | null)[] {
  return [...document.querySelectorAll("[data-slot='toast'] p")].map((title) => title.textContent);
}

function stack(): HTMLElement {
  return screen.getByRole("region", { name: "Notices" });
}

function tick(ms: number): void {
  act(() => void vi.advanceTimersByTime(ms));
}

/** How long a notice spends on its way out, which is `--motion-fast`. */
const LEAVING = 120;

/** Somebody who has asked their machine for less movement. */
function asksForLessMotion(): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("Toaster", () => {
  it("says what happened, and what else there is to say", () => {
    raise({ tone: "positive", title: "Suspend done", description: "The application answered." });

    expect(screen.getByText("Suspend done")).toBeDefined();
    expect(screen.getByText("The application answered.")).toBeDefined();
  });

  /**
   * A failure interrupts, a success does not: `alert` is read out the moment it
   * arrives, and `status` waits for a gap.
   */
  it("announces a failure and mentions a success", () => {
    raise({ tone: "critical", title: "Refund failed" }, { tone: "positive", title: "Refund done" });

    expect(screen.getByRole("alert").textContent).toContain("Refund failed");
    expect(screen.getByRole("status").textContent).toContain("Refund done");
  });

  /**
   * The tone is ink, not paint. Every notice is the same surface — a card over
   * the app with the one shadow under it — because a tinted block floating on a
   * data panel reads as a coloured hole in the page.
   */
  it("wears its tone in the title and the mark, and never in the surface", () => {
    raise({ tone: "positive", title: "Suspend done" });

    const notice = screen.getByRole("status");
    expect(notice.dataset.tone).toBe("positive");
    expect(notice.className).toContain("bg-card");
    expect(notice.className).toContain("shadow-lifted");
    expect(notice.className).not.toMatch(/bg-(positive|destructive|attention|secondary)/);
    expect(screen.getByText("Suspend done").className).toContain("text-positive-text");
  });

  it("is one surface whichever tone it is", () => {
    raise({ tone: "critical", title: "Refund failed" }, { title: "Definition reloaded" });

    for (const notice of document.querySelectorAll("[data-slot='toast']")) {
      expect(notice.className).toContain("bg-card");
      expect(notice.className).toContain("shadow-lifted");
    }
    expect(screen.getByText("Refund failed").className).toContain("text-destructive-text");
    expect(screen.getByText("Definition reloaded").className).toContain("text-secondary-foreground");
  });

  /** A notice that says nothing about how it went is quiet, as a badge is. */
  it("is neutral when it is not told otherwise", () => {
    raise({ title: "Definition reloaded" });

    expect(screen.getByRole("status").dataset.tone).toBe("neutral");
  });

  /** What just happened is where the eye already is. */
  it("stacks the newest on top", () => {
    raise({ title: "First" }, { title: "Second" }, { title: "Third" });

    expect(titles()).toEqual(["Third", "Second", "First"]);
  });

  it("shows three at a time, and the oldest is the one that goes", () => {
    raise({ title: "First" }, { title: "Second" }, { title: "Third" }, { title: "Fourth" });

    expect(titles()).toEqual(["Fourth", "Third", "Second"]);
  });

  describe("leaving", () => {
    it("can be dismissed, by a control that says which notice it dismisses", () => {
      vi.useFakeTimers();
      raise({ tone: "positive", title: "Suspend done" });

      fireEvent.click(screen.getByRole("button", { name: "Dismiss: Suspend done" }));
      tick(LEAVING);

      expect(screen.queryByRole("status")).toBeNull();
    });

    /**
     * It goes back down the four pixels it came up, and holds its place in the
     * stack while it does — the notices under it are not pulled up out from
     * under a pointer that is on its way to one of them.
     */
    it("plays its way out, and keeps its place until it has gone", () => {
      vi.useFakeTimers();
      raise({ title: "First" }, { title: "Second" });

      fireEvent.click(screen.getByRole("button", { name: "Dismiss: Second" }));

      const going = screen.getByText("Second").closest("[data-slot='toast']");
      expect(going?.className).toContain("animate-leave");
      expect(going?.className).not.toContain("animate-enter");
      // Still in the stack, and taking no more clicks while it is on its way.
      expect(titles()).toEqual(["Second", "First"]);
      expect(going?.className).toContain("pointer-events-none");

      tick(LEAVING);
      expect(titles()).toEqual(["First"]);
    });

    /** Pressing dismiss twice is one dismissal, not two. */
    it("does not start leaving a second time", () => {
      vi.useFakeTimers();
      raise({ title: "First" });

      const dismiss = screen.getByRole("button", { name: "Dismiss: First" });
      fireEvent.click(dismiss);
      fireEvent.click(dismiss);
      tick(LEAVING);

      expect(titles()).toEqual([]);
    });
  });

  describe("the clock a notice clears itself on", () => {
    it("gives a success four seconds and a failure eight", () => {
      vi.useFakeTimers();
      raise({ tone: "positive", title: "Suspend done" }, { tone: "critical", title: "Refund failed" });

      tick(4_000);
      tick(LEAVING);
      expect(screen.queryByText("Suspend done")).toBeNull();
      expect(screen.getByText("Refund failed")).toBeDefined();

      tick(4_000);
      tick(LEAVING);
      expect(screen.queryByText("Refund failed")).toBeNull();
    });

    /** Something being read is not something to take away. */
    it("stops while the stack is pointed at, and resumes where it stopped", () => {
      vi.useFakeTimers();
      raise({ tone: "positive", title: "Suspend done" });

      tick(3_000);
      fireEvent.mouseOver(stack());
      tick(60_000);
      expect(screen.getByText("Suspend done")).toBeDefined();

      fireEvent.mouseOut(stack());
      tick(900);
      expect(screen.getByText("Suspend done")).toBeDefined();

      tick(100);
      tick(LEAVING);
      expect(screen.queryByText("Suspend done")).toBeNull();
    });

    /** A keyboard reaches a notice by tabbing into it, and holds it the same way. */
    it("stops while the stack has focus", () => {
      vi.useFakeTimers();
      raise({ tone: "positive", title: "Suspend done" });

      fireEvent.focus(screen.getByRole("button", { name: "Dismiss: Suspend done" }));
      tick(60_000);

      expect(screen.getByText("Suspend done")).toBeDefined();
    });

    /**
     * Reduced motion takes the movement and leaves the function. The clock is a
     * timer rather than the end of an animation, so a notice still goes when it
     * is done — and it goes at once, because there is no exit to sit through.
     */
    it("still runs for somebody who has asked for less motion, and skips the exit", () => {
      asksForLessMotion();
      vi.useFakeTimers();
      raise({ tone: "positive", title: "Suspend done" });

      tick(4_000);
      tick(0);

      expect(screen.queryByText("Suspend done")).toBeNull();
    });

    /** Where movement is wanted, that same moment is an exit being played. */
    it("is still on its way out at that moment when movement is wanted", () => {
      vi.useFakeTimers();
      raise({ tone: "positive", title: "Suspend done" });

      tick(4_000);
      tick(0);

      expect(screen.getByText("Suspend done")).toBeDefined();
      tick(LEAVING);
      expect(screen.queryByText("Suspend done")).toBeNull();
    });
  });

  /** A column of notices must not swallow clicks meant for the screen behind it. */
  it("takes no clicks outside the notices themselves", () => {
    raise({ tone: "positive", title: "Suspend done" });

    expect(stack().parentElement?.className).toContain("pointer-events-none");
    expect(stack().className).toContain("pointer-events-auto");
  });
});

describe("useToaster", () => {
  /** A screen that forgot the stack would otherwise drop notices in silence. */
  it("refuses to be used without a stack to raise a notice into", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Raise notices={[{ title: "Nowhere" }]} />)).toThrow(
      "useToaster needs a <Toaster> above it",
    );

    quiet.mockRestore();
  });
});
