import type { ProjectDto } from "@repanel/contracts";
import { Card } from "@repanel/ui";
import { Link } from "react-router";
import { DefinitionStatusChip } from "../definition/definition-status-chip";

/**
 * One project on the list: what it is called, what it routes by, where it
 * stands. It wears the project's own mark, so a card and the switcher at the
 * top of that project's sidebar are recognisably the same object.
 */
export function ProjectCard({ project }: { project: ProjectDto }) {
  return (
    <Link
      to={`/p/${project.id}/overview`}
      className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
    >
      <Card className="flex h-full min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-muted">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-[22px] flex-none place-items-center rounded-md bg-primary text-micro font-semibold text-primary-foreground">
            {project.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-body leading-tight font-medium">{project.name}</div>
            <div className="truncate font-data text-nav-meta leading-snug text-muted-foreground">
              {project.key}
            </div>
          </div>
        </div>
        <DefinitionStatusChip projectId={project.id} />
      </Card>
    </Link>
  );
}
