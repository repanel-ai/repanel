import type { ProjectDto } from "@repanel/contracts";
import { useEffect } from "react";
import { SignOutButton } from "../auth/sign-out-button";
import { AdminLinks } from "./admin-links";
import { adminUrl } from "./admin-url";

export interface OperatorLandingProps {
  /** The admins this person may use. Never empty: with none, this is not shown. */
  admins: ProjectDto[];
  runtimeUrl: string;
}

/**
 * Where somebody who only operates admins arrives after signing in.
 *
 * They have no console: no project to configure, no page here they could open.
 * So with one admin they are sent to it, and with several they are asked which
 * — and neither screen wears the console's shell, because a frame around a
 * place you cannot go is a promise the product does not keep.
 */
export function OperatorLanding({ admins, runtimeUrl }: OperatorLandingProps) {
  const only = admins.length === 1 ? admins[0] : undefined;

  useEffect(() => {
    if (only) window.location.replace(adminUrl(runtimeUrl, only.key));
  }, [only, runtimeUrl]);

  if (only) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-sidebar-top to-sidebar-bottom p-6">
        <p role="status" className="text-small text-muted-foreground">
          Opening {only.name}…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-sidebar-top to-sidebar-bottom p-6">
      <div className="mx-auto flex w-full max-w-measure flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-title font-medium">Your admins</h1>
          <span className="text-small text-muted-foreground">
            {admins.length} to choose from
          </span>
          <div className="flex-1" />
          <SignOutButton />
        </div>

        <AdminLinks admins={admins} runtimeUrl={runtimeUrl} />
      </div>
    </main>
  );
}
