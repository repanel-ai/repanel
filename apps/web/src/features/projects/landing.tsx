import { FormError } from "@repanel/ui";
import { ConsoleShell } from "../../console-shell";
import { messageOf } from "../../lib/api-client";
import { OperatorLanding } from "./operator-landing";
import { ProjectsPage } from "./projects-page";
import { useMemberships } from "./use-projects";

/**
 * Where signing in leads, decided by what this account may reach.
 *
 * An owner gets the console. Somebody who only operates admins gets the admin
 * itself — one of them straight away, a choice between several — because the
 * console has nothing in it for them and landing there would be a room with no
 * doors (task 029).
 */
export function Landing({ runtimeUrl }: { runtimeUrl: string }) {
  const memberships = useMemberships();

  // Nothing is drawn until it is known which of the two this is: a console that
  // appears and then vanishes is worse than a moment of nothing.
  if (memberships.isPending) return null;

  if (memberships.isError) {
    return (
      <ConsoleShell>
        <FormError message={messageOf(memberships.error)} />
      </ConsoleShell>
    );
  }

  const owned = memberships.data
    .filter((membership) => membership.role === "owner")
    .map((membership) => membership.project);
  const operated = memberships.data
    .filter((membership) => membership.role === "operator")
    .map((membership) => membership.project);

  if (owned.length === 0 && operated.length > 0) {
    return <OperatorLanding admins={operated} runtimeUrl={runtimeUrl} />;
  }

  return (
    <ConsoleShell>
      <ProjectsPage owned={owned} operated={operated} runtimeUrl={runtimeUrl} />
    </ConsoleShell>
  );
}
