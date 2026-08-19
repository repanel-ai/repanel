import type { ReactNode } from "react";
import { SignedOutNotice } from "./signed-out-notice";
import { useSession } from "./use-session";

/**
 * Shows the admin to whoever is signed in, and directs everyone else to the
 * console. Renders nothing while the answer is in flight.
 */
export function SessionGate({ consoleUrl, children }: { consoleUrl: string; children: ReactNode }) {
  const { user, isPending } = useSession();

  if (isPending) return null;
  if (!user) return <SignedOutNotice consoleUrl={consoleUrl} />;
  return <>{children}</>;
}
