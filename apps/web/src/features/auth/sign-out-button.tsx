import { Button } from "@repanel/ui";
import { useAuth } from "./use-auth";

/**
 * Ends the session. No redirect of its own: the session goes stale, RequireAuth
 * sees no user, and /login is where that already leads.
 */
export function SignOutButton() {
  const { logout } = useAuth();

  return (
    <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
      Sign out
    </Button>
  );
}
