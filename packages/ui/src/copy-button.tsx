import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./class-names";
import { CheckIcon, CopyIcon } from "./icons";

/** How long the control says it worked before going back to offering. */
const ACKNOWLEDGED_MS = 1600;

export interface CopyButtonProps {
  /** What lands on the clipboard. */
  value: string;
  /** What is being copied, named for the control: "Copy the record id". */
  what: string;
  /** What is shown — normally the value itself. */
  children: ReactNode;
  className?: string;
}

/**
 * A value that can be taken. It reads as the value first and as a control
 * second: the glyph sits back until the control is pointed at, because the
 * thing worth seeing is what is written there, not the fact that it copies.
 */
export function CopyButton({ value, what, children, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), ACKNOWLEDGED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // A clipboard the browser will not hand over is not a reason to break
      // the page: the value is on screen and selectable either way.
    }
  };

  return (
    <>
      <button
        type="button"
        data-slot="copy-button"
        title={copied ? `Copied ${what}` : `Copy ${what}`}
        onClick={() => void copy()}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded-sm text-muted-foreground outline-none",
          "transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
          className,
        )}
      >
        {children}
        {copied ? (
          <CheckIcon className="size-3 shrink-0" />
        ) : (
          <CopyIcon className="size-3 shrink-0 opacity-55 group-hover:opacity-100" />
        )}
        {/* Punctuation rather than a space: the name computation trims each
            node, so a space would be dropped and the value would run straight
            into the action when it is read out. */}
        <span className="sr-only">{`, copy ${what}`}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `Copied ${what}` : ""}
      </span>
    </>
  );
}
