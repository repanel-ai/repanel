import { CopyButton, FormError, Skeleton } from "@repanel/ui";
import { Link, useParams } from "react-router";
import { messageOf } from "../../lib/api-client";
import { AgentAccessSection } from "../agent-access/agent-access-section";
import { ConnectionSection } from "../connection/connection-section";
import { DefinitionSection } from "../definition/definition-section";
import { useProject } from "./use-projects";

export interface ProjectPageProps {
  /** Where the API answers from outside the browser, for the setup snippet. */
  apiUrl: string;
  /** Where the rendered admin is served — a different origin in dev (#025). */
  runtimeUrl: string;
}

/**
 * One project, set up. The three sections are the three things that have to be
 * true before an admin exists — a database to read, an agent that can reach the
 * project, and a definition it has written — in the order they have to be done.
 */
export function ProjectPage({ apiUrl, runtimeUrl }: ProjectPageProps) {
  const { id = "" } = useParams();
  const project = useProject(id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          to="/"
          className="w-fit rounded-sm text-small text-sidebar-muted outline-none hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          ← Projects
        </Link>
        {project.isPending ? (
          <Skeleton className="h-7 w-56" />
        ) : (
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-title font-medium">{project.data?.name}</h1>
            {project.data && (
              <CopyButton value={project.data.key} what="the project key">
                <span className="font-data text-small">{project.data.key}</span>
              </CopyButton>
            )}
          </div>
        )}
        <FormError message={messageOf(project.error)} />
      </div>

      {project.data && (
        <>
          <ConnectionSection projectId={project.data.id} />
          <AgentAccessSection projectId={project.data.id} apiUrl={apiUrl} />
          <DefinitionSection
            projectId={project.data.id}
            projectKey={project.data.key}
            runtimeUrl={runtimeUrl}
          />
        </>
      )}
    </div>
  );
}
