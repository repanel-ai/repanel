import type { ComponentProps } from "react";
import { cn } from "./class-names";

export type TextareaProps = ComponentProps<"textarea">;

/**
 * A field for something written rather than entered: the one control whose
 * value has line breaks in it, drawn in the same clothes as `Input` so a form
 * reads as one set of controls.
 *
 * It opens at three lines and grows by hand. Nothing measures the text and
 * resizes for it: the box would move under a pointer while somebody is typing
 * into it, and a surface that changes height while it is being used is the one
 * thing the motion rules are strictest about (DESIGN.md §12).
 */
export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        "w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2",
        "text-body leading-5 text-foreground outline-none placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
