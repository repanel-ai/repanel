import { Button, EmptyPanel, FormError, Skeleton } from "@repanel/ui";
import { useState } from "react";
import { PageHead } from "../../page-head";
import { messageOf } from "../../lib/api-client";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard } from "./project-card";
import { useProjects } from "./use-projects";

/** Everything this account administers. One project is one admin. */
export function ProjectsPage() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <PageHead
          title="Projects"
          meta={projects.data ? countOf(projects.data.length) : undefined}
        />
        <div className="flex-1" />
        <Button onClick={() => setCreating(true)}>New project</Button>
      </div>

      {projects.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[102px]" />
          <Skeleton className="h-[102px]" />
        </div>
      )}

      <FormError message={messageOf(projects.error)} />

      {projects.data?.length === 0 && (
        <div className="rounded-lg border border-border bg-card">
          <EmptyPanel
            title="No projects yet"
            description="A project is one admin. Create one, connect its database, and point your agent at it."
            action={<Button onClick={() => setCreating(true)}>New project</Button>}
          />
        </div>
      )}

      {projects.data && projects.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function countOf(total: number): string {
  return `${total} ${total === 1 ? "project" : "projects"}`;
}
