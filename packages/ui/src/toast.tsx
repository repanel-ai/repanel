import type { ReactNode } from "react";
import { cn } from "./class-names";
import { CloseIcon } from "./icons";

/**
 * How a notice reads. The two names are the badge language's own (DECISIONS
 * #029), spent on the same tints: a notice about something that went well and
 * one about something that did not are the same kind of object, told apart the
 * way every other state on the screen is.
 */
export type ToastTone = "positive" | "critical";

const TONES: Record<ToastTone, string> = {
  positive: "border-positive-line bg-positive-soft",
  critical: "border-destructive-line bg-destructive-soft",
};

const TITLE_TONES: Record<ToastTone, string> = {
  positive: "text-positive-text",
  critical: "text-destructive-text",
};

export interface ToastProps {
  tone: ToastTone;
  /** What happened, in four or five words. */
  title: string;
  /** What else there is to say — usually the message something else wrote. */
  description?: ReactNode;
  onDismiss: () => void;
}

/**
 * One notice about something that has already happened. A failure announces
 * itself; a success is said politely, because the screen behind it has already
 * changed and the notice is only confirming it.
 */
export function Toast({ tone, title, description, onDismiss }: ToastProps) {
  return (
    <div
      data-slot="toast"
      data-tone={tone}
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-[min(26rem,calc(100vw-2rem))] items-start gap-2.5",
        "rounded-lg border px-3.5 py-3",
        // It was not on the screen a moment ago, so it arrives (DESIGN.md §12).
        // Dismissing takes it off the screen at once: an operator who has read
        // a notice and closed it is not made to watch it leave.
        "animate-enter",
        TONES[tone],
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-body font-medium", TITLE_TONES[tone])}>{title}</p>
        {description !== undefined && <p className="text-body text-foreground">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss: ${title}`}
        className={cn(
          "-mr-1 -mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground outline-none",
          "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
        )}
      >
        <CloseIcon className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Where notices stack: bottom right, newest last, over everything and in the
 * way of nothing — the column itself takes no clicks, only the notices in it.
 */
export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4">
      {children}
    </div>
  );
}
