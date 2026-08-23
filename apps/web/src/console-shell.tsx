import type { ReactNode } from "react";
import { SignOutButton } from "./features/auth/sign-out-button";
import { useAuth } from "./features/auth/use-auth";
import { ThemeToggle } from "./features/theme/theme-toggle";

/**
 * The console's one surface. It is the runtime's own chrome — the same gradient,
 * the same tokens — with no panel inset and no sidebar: there is one screen at a
 * time here, and the width a control plane needs is the width of a form.
 *
 * Everything inside is set at the runtime's sizes and spaced further apart. A
 * console is visited to change one thing and left again; the density that makes
 * a table of five hundred records scannable would only crowd it (DESIGN.md §6).
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-linear-to-b from-sidebar-top to-sidebar-bottom">
      <header className="mx-auto flex h-top w-full max-w-4xl items-center gap-3 px-5">
        <span className="text-brand font-medium text-sidebar-foreground">RePanel</span>
        <div className="flex-1" />
        {user && <span className="text-nav-meta text-sidebar-muted">{user.email}</span>}
        <ThemeToggle />
        <SignOutButton />
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pt-4 pb-20">{children}</main>
    </div>
  );
}
