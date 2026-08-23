import { Button, EmptyPanel, FormError, Skeleton } from "@repanel/ui";
import { useState } from "react";
import { messageOf } from "../../lib/api-client";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard } from "./project-card";
import { useProjects } from "./use-projects";

/** Everything this account administers. One project is one admin. */
export function ProjectsPage() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h1 className="text-title font-medium">Projects</h1>
        <div className="flex-1" />
        <Button onClick={() => setCreating(true)}>New project</Button>
      </div>

      {projects.isPending && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
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
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
