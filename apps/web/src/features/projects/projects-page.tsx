import type { ProjectDto } from "@repanel/contracts";
import { Button, EmptyPanel } from "@repanel/ui";
import { useState } from "react";
import { PageHead } from "../../page-head";
import { AdminLinks } from "./admin-links";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard } from "./project-card";

export interface ProjectsPageProps {
  /** The projects this account owns: the ones the console is about. */
  owned: ProjectDto[];
  /** Admins it may use but not configure. Empty for most people. */
  operated: ProjectDto[];
  runtimeUrl: string;
}

/** Everything this account administers. One project is one admin. */
export function ProjectsPage({ owned, operated, runtimeUrl }: ProjectsPageProps) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <PageHead title="Projects" meta={countOf(owned.length)} />
        <div className="flex-1" />
        <Button onClick={() => setCreating(true)}>New project</Button>
      </div>

      {owned.length === 0 && (
        <div className="rounded-lg border border-border bg-card">
          <EmptyPanel
            title="No projects yet"
            description="A project is one admin. Create one, connect its database, and point your agent at it."
            action={<Button onClick={() => setCreating(true)}>New project</Button>}
          />
        </div>
      )}

      {owned.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {owned.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Somebody else's project, which this account works in rather than
          configures. It is a link out to the admin and nothing else: there is
          no console page here they could open. */}
      {operated.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <PageHead title="Admins you use" meta="projects somebody else owns" />
          <AdminLinks admins={operated} runtimeUrl={runtimeUrl} />
        </div>
      )}

      <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function countOf(total: number): string {
  return `${total} ${total === 1 ? "project" : "projects"}`;
}
