import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./use-auth";

/**
 * Guards a route behind a session. Renders nothing while the answer is still
 * in flight — redirecting first would bounce every reload through /login.
 *
 * Where it was going is carried to the login page, because some of these
 * addresses are handed out: an agent sends a human to a project's connection
 * page, and `repanel link` sends one here with the port its CLI is listening
 * on. Losing the address to a sign-in loses the errand with it.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending } = useAuth();
  const location = useLocation();

  if (isPending) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}
