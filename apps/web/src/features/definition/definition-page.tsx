import { Card, EmptyPanel, FormError, Skeleton } from "@repanel/ui";
import { useParams } from "react-router";
import { PageHead } from "../../page-head";
import { messageOf } from "../../lib/api-client";
import { useProject } from "../projects/use-projects";
import { DraftDefinition } from "./draft-definition";
import { PublishedDefinition } from "./published-definition";
import { useDefinitionStatus } from "./use-definition-status";

/**
 * How the project's definition stands, and what to do about it.
 *
 * Two facts, in the order they matter: the version operators are being served,
 * and the draft the agent is working on. A project with nothing submitted at
 * all is neither of those — it is the loop not having run yet, and it gets the
 * screen it had before any of this existed.
 */
export function DefinitionPage({ runtimeUrl }: { runtimeUrl: string }) {
  const { id = "" } = useParams();
  const project = useProject(id);
  const status = useDefinitionStatus(id);

  const head = (
    <PageHead
      title="Definition"
      meta="what your agent submitted, and what your operators are being served"
    />
  );

  if (!status.data) {
    return (
      <>
        {head}
        <Card className="flex flex-col gap-4 p-5">
          {status.isError ? (
            <FormError message={messageOf(status.error)} />
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </Card>
      </>
    );
  }

  const { draft, published, unpublishedChanges } = status.data;

  if (draft.status === "none") {
    return (
      <>
        {head}
        <Card>
          <EmptyPanel
            className="py-6"
            title="No definition yet"
            description={
              "Connect your agent on the Agent access page, then ask it to create your admin. " +
              "It reads your database, writes the definition, and submits it — this page " +
              "changes on its own when it lands."
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {head}

      <PublishedDefinition
        published={published}
        unpublishedChanges={unpublishedChanges}
        adminUrl={project.data ? `${runtimeUrl}/a/${project.data.key}` : null}
      />

      <DraftDefinition projectId={id} draft={draft} unpublishedChanges={unpublishedChanges} />
    </>
  );
}
