import { FormError, Skeleton } from "@repanel/ui";
import { useParams } from "react-router";
import { PageHead } from "../../page-head";
import { messageOf } from "../../lib/api-client";
import { SetupCommand } from "../agent-access/setup-command";
import { useAgentTokens } from "../agent-access/use-agent-access";
import { useConnection } from "../connection/use-connection";
import { useDefinitionStatus } from "../definition/use-definition-status";
import { SetupChecklist } from "./setup-checklist";
import { setupSteps } from "./setup-steps";
import { StatusCards } from "./status-cards";

/**
 * Where a project stands, and what is left to do about it.
 *
 * Both halves are read off the three requests the project's other pages already
 * make — the connection, the tokens, the definition status. This page asks the
 * API nothing of its own, and the checklist is derived on every render rather
 * than stored, so it cannot drift from what those endpoints answered.
 */
export function OverviewPage({ apiUrl }: { apiUrl: string }) {
  const { id = "" } = useParams();
  const connection = useConnection(id);
  const tokens = useAgentTokens(id);
  const definition = useDefinitionStatus(id);

  const error = messageOf(connection.error ?? tokens.error ?? definition.error);
  const ready =
    connection.data !== undefined && tokens.data !== undefined && definition.data !== undefined;

  if (!ready) {
    return (
      <>
        <PageHead title="Overview" />
        <FormError message={error} />
        {!error && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
            </div>
            <Skeleton className="h-64" />
          </>
        )}
      </>
    );
  }

  const steps = setupSteps({
    connection: connection.data,
    tokens: tokens.data,
    definition: definition.data,
  });
  const done = steps.filter((step) => step.state === "done").length;

  return (
    <>
      <PageHead title="Overview" meta={`${done} of ${steps.length} steps done`} />

      <StatusCards
        connection={connection.data}
        tokens={tokens.data}
        definition={definition.data}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-body font-medium">Set up this admin</h2>
        <SetupChecklist steps={steps} extra={{ agent: <Extra apiUrl={apiUrl} /> }} />
      </div>
    </>
  );
}

/** What the step you are on needs in front of it: the command, and one press. */
function Extra({ apiUrl }: { apiUrl: string }) {
  return (
    <div className="mt-2.5">
      <SetupCommand apiUrl={apiUrl} />
    </div>
  );
}
