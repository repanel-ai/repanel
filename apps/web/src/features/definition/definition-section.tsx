import { Card, EmptyPanel, FormError, Section, Skeleton, buttonClasses } from "@repanel/ui";
import { messageOf } from "../../lib/api-client";
import { formatMoment } from "../../lib/format-date";
import { DefinitionErrors } from "./definition-errors";
import { useDefinitionStatus } from "./use-definition-status";

export interface DefinitionSectionProps {
  projectId: string;
  /** What the runtime routes by; the admin's address is built from it. */
  projectKey: string;
  /** Where the rendered admin is served — a different origin in dev (#025). */
  runtimeUrl: string;
}

/**
 * How the project's definition stands, and what to do about it. The three
 * states are three different screens because they are three different moments:
 * before the loop has run, while it is being repaired, and after it works.
 */
export function DefinitionSection({ projectId, projectKey, runtimeUrl }: DefinitionSectionProps) {
  const status = useDefinitionStatus(projectId);

  return (
    <Section title="Definition">
      <Card className="flex flex-col gap-4">
        {status.isPending && <Skeleton className="h-16 w-full" />}

        {status.isError && (
          <FormError message={messageOf(status.error)} />
        )}

        {status.data?.status === "none" && (
          <EmptyPanel
            className="py-6"
            title="No definition yet"
            description={
              "Connect your agent with the setup above, then ask it to create your admin. " +
              "It reads your database, writes the definition, and submits it — this card " +
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

        {status.data?.status === "valid" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-muted-foreground">
              Submitted {formatMoment(status.data.updatedAt)}
            </p>
            <a className={buttonClasses()} href={`${runtimeUrl}/a/${projectKey}`}>
              Open admin
            </a>
          </div>
        )}
      </Card>
    </Section>
  );
}

