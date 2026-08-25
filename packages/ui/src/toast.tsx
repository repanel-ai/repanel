import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "./class-names";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon, type IconProps } from "./icons";

/**
 * How a notice reads. The names are the badge language's own (DECISIONS #029),
 * spent on the same text colours: a notice about something that went well and
 * one about something that did not are the same kind of object as the states in
 * a table, told apart the way every other state on the screen is. `neutral` is
 * the quiet treatment, for a notice that is neither.
 *
 * The tone is the mark and the title and nothing else. A notice is one surface
 * — `--card`, with the product's one shadow under it — because it floats over
 * the app rather than sitting in it, and a tinted block floating over a data
 * panel reads as a coloured hole in the page (DECISIONS #052).
 */
export type ToastTone = "neutral" | "positive" | "critical";

/**
 * How long a notice stays up, by what it says.
 *
 * A success is a receipt for something the operator can already see — the badge
 * behind it has changed — so it goes quickly. A failure carries the only
 * account of what happened that will ever reach that browser, so it is given
 * twice as long to be read, and the clock stops while it is being read.
 *
 * Both leave on their own because the stack is bounded (`AT_MOST`): a notice
 * that never went would hold a slot against every notice after it.
 */
const CLEARS_AFTER: Record<ToastTone, number> = {
  positive: 4_000,
  neutral: 4_000,
  critical: 8_000,
};

/**
 * How many notices are on screen at once. A fourth takes the oldest one's
 * place: what an operator has just done is what they are looking for, and a
 * corner that grows without limit stops being a corner.
 */
const AT_MOST = 3;

/** What a notice says. */
export interface ToastMessage {
  /** Absent is `neutral`: something that says nothing about how it went. */
  tone?: ToastTone;
  /** What happened, in four or five words. */
  title: string;
  /** What else there is to say — usually the message something else wrote. */
  description?: ReactNode;
}

interface Notice extends ToastMessage {
  readonly id: number;
  /** Dismissed, and on its way out. It holds its place until it has gone. */
  readonly leaving?: boolean;
}

/**
 * How long a notice takes to leave: `--motion-fast`, written out, because what
 * removes the element is a timer and what moves it is a stylesheet, and the two
 * have to agree. Under reduced motion there is nothing to wait for.
 */
const LEAVES_OVER = 120;

/**
 * How anything on the screen raises a notice.
 *
 * Raising one is the whole of it: taking one back is the operator's, through
 * the dismiss every notice carries, or the clock's. Nothing that raises a
 * notice has ever wanted it back.
 */
export interface Notices {
  notify(message: ToastMessage): void;
}

const ToasterContext = createContext<Notices | null>(null);

/**
 * The notices, from anywhere under the `<Toaster>`.
 *
 * A notice is about something that has already happened, so it must outlive
 * whatever raised it: an action that succeeds can take its own button off the
 * screen, and the account of it is not the button's to leave with.
 */
export function useToaster(): Notices {
  const toaster = useContext(ToasterContext);
  if (!toaster) throw new Error("useToaster needs a <Toaster> above it");
  return toaster;
}

/**
 * Where notices live: one stack in the corner, owned by the app rather than by
 * any screen in it.
 *
 * It wraps the app instead of sitting beside it so that there is exactly one
 * stack however many screens come and go under it, and so that a notice raised
 * by a component's last render is still there after that component is gone.
 */
export function Toaster({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState<readonly Notice[]>([]);
  const [held, setHeld] = useState(false);
  const last = useRef(0);

  /**
   * Dismissing marks a notice rather than removing it: it has an exit to play,
   * and it holds its place in the stack while it plays so the notices under it
   * are not pulled up out from under a pointer.
   */
  const dismiss = useCallback((id: number) => {
    setOpen((notices) =>
      notices.map((notice) => (notice.id === id ? { ...notice, leaving: true } : notice)),
    );
  }, []);

  const remove = useCallback((id: number) => {
    setOpen((notices) => notices.filter((notice) => notice.id !== id));
  }, []);

  const notify = useCallback((message: ToastMessage) => {
    last.current += 1;
    const notice = { ...message, id: last.current };
    // Newest first, which is topmost: the stack grows downward from the corner,
    // so what just happened is where the eye already is.
    setOpen((notices) => [notice, ...notices].slice(0, AT_MOST));
  }, []);

  const toaster = useMemo<Notices>(() => ({ notify }), [notify]);

  return (
    <ToasterContext value={toaster}>
      {children}
      <ToastViewport onHold={setHeld}>
        {open.map((notice) => (
          <Toast
            key={notice.id}
            notice={notice}
            held={held}
            onDismiss={dismiss}
            onGone={remove}
          />
        ))}
      </ToastViewport>
    </ToasterContext>
  );
}

/**
 * The column itself: the top right of the panel, over everything and in the way
 * of nothing.
 *
 * It clears the topbar rather than starting at the top of the window. Both of
 * RePanel's shells put the same chrome in that corner — a theme toggle, and
 * either `Refresh` or the way out — and a notice landing on a control is a
 * control that cannot be pressed for as long as the notice is up. So the stack
 * begins under the bar and inside the panel's own gutter: `--spacing-top` for
 * the bar, and 16px for the panel's 8px margin plus an 8px gap.
 *
 * The fixed layer takes no clicks at all; only the stack inside it does, and
 * that box is exactly as tall as the notices in it — so an empty corner is an
 * empty corner. Pointing at the stack, or tabbing into it, holds every clock in
 * it: something being read is not something to take away.
 */
function ToastViewport({ children, onHold }: { children: ReactNode; onHold: (held: boolean) => void }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end px-4 pt-[calc(var(--spacing-top)+1rem)]">
      <div
        role="region"
        aria-label="Notices"
        className="pointer-events-auto flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2"
        onMouseEnter={() => onHold(true)}
        onMouseLeave={() => onHold(false)}
        onFocus={() => onHold(true)}
        onBlur={() => onHold(false)}
      >
        {children}
      </div>
    </div>
  );
}

const TITLE_TONES: Record<ToastTone, string> = {
  neutral: "text-secondary-foreground",
  positive: "text-positive-text",
  critical: "text-destructive-text",
};

const MARKS: Record<ToastTone, (props: IconProps) => ReactNode> = {
  neutral: InfoIcon,
  positive: CheckIcon,
  critical: AlertIcon,
};

/**
 * One notice about something that has already happened.
 *
 * A failure announces itself and a success is said politely: `alert` is read
 * out the moment it arrives, `status` waits for a gap. The glyph says which
 * before the colour does, so the tones are a second signal rather than the only
 * one (DESIGN.md §7).
 */
function Toast({
  notice,
  held,
  onDismiss,
  onGone,
}: {
  notice: Notice;
  held: boolean;
  onDismiss: (id: number) => void;
  onGone: (id: number) => void;
}) {
  const { id, tone = "neutral", title, description, leaving = false } = notice;
  const Mark = MARKS[tone];
  const dismiss = useCallback(() => onDismiss(id), [id, onDismiss]);

  // A notice on its way out has no clock left to run.
  useAutoDismiss(CLEARS_AFTER[tone], held || leaving, dismiss);
  useExit(leaving, useCallback(() => onGone(id), [id, onGone]));

  return (
    <div
      data-slot="toast"
      data-tone={tone}
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-xl border border-border px-3.5 py-3",
        // Over the app rather than in it: the ladder's one shadow, and the one
        // place it is spent (DESIGN.md §2).
        "bg-card shadow-lifted",
        // It was not on the screen a moment ago, so it arrives; and it goes back
        // down the way it came, quicker than it came (DESIGN.md §12).
        leaving ? "pointer-events-none animate-leave" : "animate-enter",
      )}
    >
      <Mark className={cn("mt-px size-4 shrink-0", TITLE_TONES[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-body font-medium", TITLE_TONES[tone])}>{title}</p>
        {description !== undefined && <div className="text-body text-foreground">{description}</div>}
      </div>
      <button
        type="button"
        onClick={dismiss}
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
 * The clock a notice clears itself on, and the pause on it.
 *
 * It is a timer rather than the end of an animation, which is what makes
 * `prefers-reduced-motion` take the movement and leave the function: the
 * vocabulary collapses to `0ms` and the stylesheet stops the rise, and a notice
 * still goes when it is done (DESIGN.md §12). Held, what is left of the clock
 * is kept, so a notice let go of resumes rather than restarting.
 */
function useAutoDismiss(after: number, held: boolean, dismiss: () => void): void {
  const left = useRef(after);
  const started = useRef(0);

  useEffect(() => {
    if (held) return;
    started.current = Date.now();
    const timer = window.setTimeout(dismiss, left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(0, left.current - (Date.now() - started.current));
    };
  }, [held, dismiss]);
}

/**
 * The moment between a notice being dismissed and the element going.
 *
 * It is a timer rather than an `animationend` listener for the same reason the
 * auto-dismiss is: the end of an animation is not a thing that reliably
 * happens. Under `prefers-reduced-motion` there is no animation to wait for at
 * all, so the notice goes at once — which is what §12 means by the vocabulary
 * collapsing to `0ms`.
 */
function useExit(leaving: boolean, gone: () => void): void {
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(gone, motionIsWanted() ? LEAVES_OVER : 0);
    return () => window.clearTimeout(timer);
  }, [leaving, gone]);
}

/**
 * Whether this machine wants movement. Asked rather than assumed, and guarded,
 * because `matchMedia` is a browser's and not every environment a component
 * renders in has one.
 */
function motionIsWanted(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
