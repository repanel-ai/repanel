import { Card, EmptyPanel, FormError, Skeleton, buttonClasses } from "@repanel/ui";
import { useParams } from "react-router";
import { PageHead } from "../../page-head";
import { messageOf } from "../../lib/api-client";
import { formatMoment } from "../../lib/format-date";
import { useProject } from "../projects/use-projects";
import { DefinitionErrors } from "./definition-errors";
import { useDefinitionStatus } from "./use-definition-status";

/**
 * How the project's definition stands, and what to do about it. The three
 * states are three different screens because they are three different moments:
 * before the loop has run, while it is being repaired, and after it works.
 */
export function DefinitionPage({ runtimeUrl }: { runtimeUrl: string }) {
  const { id = "" } = useParams();
  const project = useProject(id);
  const status = useDefinitionStatus(id);

  return (
    <>
      <PageHead title="Definition" meta="what your agent submitted, and what RePanel renders from it" />

      <Card className="flex flex-col gap-4 p-5">
        {status.isPending && <Skeleton className="h-16 w-full" />}

        {status.isError && <FormError message={messageOf(status.error)} />}

        {status.data?.status === "none" && (
          <EmptyPanel
            className="py-6"
            title="No definition yet"
            description={
              "Connect your agent on the Agent access page, then ask it to create your admin. " +
              "It reads your database, writes the definition, and submits it — this page " +
              "changes on its own when it lands."
            }
          />
        )}

        {status.data?.status === "invalid" && (
          <>
            <p className="text-body">
              The last definition your agent submitted did not validate.{" "}
              <span className="text-muted-foreground">
                It is stored as it was sent, so nothing is lost — the agent can read these
                problems back and repair it.
              </span>
            </p>
            <DefinitionErrors errors={status.data.errors} />
          </>
        )}

        {status.data?.status === "valid" && project.data && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-muted-foreground">
              Submitted {formatMoment(status.data.updatedAt)}
            </p>
            <a className={buttonClasses()} href={`${runtimeUrl}/a/${project.data.key}`}>
              Open admin
            </a>
          </div>
        )}
      </Card>
    </>
  );
}
