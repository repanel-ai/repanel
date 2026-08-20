import { cn } from "@repanel/ui";
import type { ReactNode } from "react";

/**
 * The panel's content area, and the same one on every screen: the gutters and
 * the rhythm between blocks are fixed here so two screens cannot drift apart.
 *
 * A table owns its own scrolling — its footer docks to the last row inside its
 * frame — so the screen beneath it must not scroll. A record is as long as its
 * sections make it, and scrolls.
 */
export function Screen({ scrolls = false, children }: { scrolls?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3.5 pb-3", scrolls && "overflow-y-auto")}
    >
      {children}
    </div>
  );
}
