import type { ProjectDto } from "@repanel/contracts";
import { Card } from "@repanel/ui";
import { Link } from "react-router";
import { DefinitionStatusChip } from "../definition/definition-status-chip";

/** One project on the list: what it is called, what it routes by, where it stands. */
export function ProjectCard({ project }: { project: ProjectDto }) {
  return (
    <Link
      to={`/p/${project.id}`}
      className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
    >
      <Card className="flex h-full flex-col items-start gap-2 p-4 transition-colors hover:bg-muted">
        <span className="text-body font-medium">{project.name}</span>
        <span className="font-data text-small text-muted-foreground">{project.key}</span>
        <DefinitionStatusChip projectId={project.id} />
      </Card>
    </Link>
  );
}
