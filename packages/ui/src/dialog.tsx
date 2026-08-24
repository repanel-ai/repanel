import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./class-names";

export interface DialogProps {
  open: boolean;
  /** What is being decided, in a few words. */
  title: string;
  /** Why the question is being asked. */
  children: ReactNode;
  /** The word on the button that goes ahead. */
  confirmLabel: string;
  /** Shown while whatever was confirmed is still running. Nothing when absent. */
  pending?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A question with two answers, asked over the screen it is about.
 *
 * It is the browser's own `<dialog>`, opened modally. That is the whole of the
 * reason: the top layer, the backdrop, the focus trap, the escape key and
 * making the rest of the page inert are all things the platform does correctly
 * and nobody should write again. What is written here is what it looks like.
 *
 * Opening focuses `Cancel`, because it is the first control inside — which is
 * the right default for a question whose other answer does something.
 */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape, which the browser raises as `cancel`. It is taken rather than
      // let through so the owner's state and the element's cannot disagree —
      // and it is refused while something is running, because there is nothing
      // left to cancel by then.
      onCancel={(event) => {
        event.preventDefault();
        if (pending === undefined) onCancel();
      }}
      // A stray click is not an answer: the backdrop dismisses nothing.
      //
      // It arrives rather than appears, and the arrival is keyed off `open` —
      // the attribute the platform adds when `showModal` runs — so there is
      // nothing to unwind on the way out. A question that has been answered
      // leaves the instant it is answered (DESIGN.md §12).
      className={cn(
        "m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0",
        "text-foreground backdrop:bg-black/45",
        "open:animate-enter backdrop:animate-fade",
      )}
    >
      <div className="flex flex-col gap-2 p-4">
        <h2 id={titleId} className="text-body font-medium">
          {title}
        </h2>
        <p id={bodyId} className="text-body text-muted-foreground">
          {children}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {pending !== undefined && (
            <span role="status" className="text-small text-muted-foreground">
              {pending}
            </span>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onCancel} disabled={pending !== undefined}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending !== undefined}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
