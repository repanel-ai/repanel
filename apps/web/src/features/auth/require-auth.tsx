import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./use-auth";

/**
 * Guards a route behind a session. Renders nothing while the answer is still
 * in flight — redirecting first would bounce every reload through /login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending } = useAuth();

  if (isPending) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
