import { cn } from "@repanel/ui";
import type { ReactNode } from "react";

/**
 * The panel's content area, and the same one on every console screen. It caps
 * its measure and centres it: the panel keeps filling the window because it is
 * the app's frame, and the content stops growing because nothing in a console
 * is a table that wants every pixel.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-5">
      <div className={cn("mx-auto flex w-full max-w-measure flex-col gap-5", className)}>
        {children}
      </div>
    </div>
  );
}
