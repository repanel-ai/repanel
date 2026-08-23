import { Button } from "@repanel/ui";
import type { ReactNode } from "react";
import { useAuth } from "./use-auth";

export interface SignOutButtonProps {
  /** How this surface dresses it: the console has two, drawn differently. */
  className?: string;
  children?: ReactNode;
}

/**
 * Ends the session. No redirect of its own: the session goes stale, RequireAuth
 * sees no user, and /login is where that already leads.
 *
 * It takes its clothes from the caller because the console shows it twice — as
 * a control in the project list's header, and as a row in a project's sidebar
 * nav — and those are two drawings of one action, not two actions.
 */
export function SignOutButton({ className, children }: SignOutButtonProps) {
  const { logout } = useAuth();

  return (
    <Button
      variant="ghost"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      className={className}
    >
      {children ?? "Sign out"}
    </Button>
  );
}
