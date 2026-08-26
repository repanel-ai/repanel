import { FormError } from "@repanel/ui";
import { Link, Outlet, useParams } from "react-router";
import { useAuth } from "./features/auth/use-auth";
import { ThemeToggle } from "./features/theme/theme-toggle";
import { useProject } from "./features/projects/use-projects";
import { ProjectNav } from "./project-nav";
import { Screen } from "./screen";
import { messageOf } from "./lib/api-client";

/**
 * One project, and the five pages it has. The shell is the runtime's own —
 * navigation on the left, a panel inset off the same ground, one screen inside
 * it — because the console and the admin are one product and this is where that
 * is felt (DESIGN.md §11).
 *
 * The pages are routed children rather than sections stacked in a column:
 * a person in a console is *somewhere*, and a page that scrolls past everything
 * else has nowhere to say so.
 */
export function ProjectShell() {
  const { id = "" } = useParams();
  const project = useProject(id);
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-b from-sidebar-top to-sidebar-bottom">
      <ProjectNav project={project.data} user={user} />

      <main className="m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-background">
        <div className="flex h-top flex-none items-center gap-2.5 border-b border-border px-4">
          <p className="truncate text-small text-muted-foreground">
            <Link to="/" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45">
              Projects
            </Link>{" "}
            <span className="opacity-50">/</span>{" "}
            <span className="font-medium text-foreground">{project.data?.name ?? "…"}</span>
          </p>
          <div className="flex-1" />
          <ThemeToggle />
        </div>

        <Screen>
          {project.isError ? <FormError message={messageOf(project.error)} /> : <Outlet />}
        </Screen>
      </main>
    </div>
  );
}
