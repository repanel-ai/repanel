import type { ReactNode } from "react";
import { SignOutButton } from "./features/auth/sign-out-button";
import { useAuth } from "./features/auth/use-auth";
import { ThemeToggle } from "./features/theme/theme-toggle";
import { Screen } from "./screen";

/**
 * Everything above a project: the list, and the way out. It is the project
 * shell with the sidebar taken away, because there is no project to navigate —
 * the same ground, the same inset panel, the same topbar, the same measure.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-b from-sidebar-top to-sidebar-bottom">
      <main className="m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-background">
        <div className="flex h-top flex-none items-center gap-2.5 border-b border-border px-4">
          <span className="text-brand font-semibold tracking-[-0.01em]">RePanel</span>
          <div className="flex-1" />
          {user && <span className="truncate text-nav-meta text-muted-foreground">{user.email}</span>}
          <ThemeToggle />
          <SignOutButton />
        </div>

        <Screen>{children}</Screen>
      </main>
    </div>
  );
}
