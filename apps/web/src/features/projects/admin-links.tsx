import type { ProjectDto } from "@repanel/contracts";
import { Card } from "@repanel/ui";
import { adminUrl } from "./admin-url";

/**
 * The admins an operator may open, as links out of the console. They are
 * anchors rather than router links because the rendered admin is a different
 * origin (DECISIONS #025), and they carry the project's own mark so a card here
 * and the sidebar over there are recognisably the same thing.
 */
export function AdminLinks({ admins, runtimeUrl }: { admins: ProjectDto[]; runtimeUrl: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {admins.map((project) => (
        <a
          key={project.id}
          href={adminUrl(runtimeUrl, project.key)}
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
            <span className="text-small text-muted-foreground">Open admin</span>
          </Card>
        </a>
      ))}
    </div>
  );
}
