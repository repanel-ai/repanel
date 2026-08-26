import type { ProjectDto, UserDto } from "@repanel/contracts";
import { ResourceIcon, SignOutIcon, ChevronDownIcon, Skeleton, cn } from "@repanel/ui";
import { Link, NavLink } from "react-router";
import { SignOutButton } from "./features/auth/sign-out-button";

/** The five pages a project has, in the order they have to be done. */
const PAGES = [
  { to: "overview", label: "Overview", icon: "activity" },
  { to: "connection", label: "Connection", icon: "database" },
  { to: "agents", label: "Agent access", icon: "key" },
  { to: "definition", label: "Definition", icon: "file" },
  // Last because it is the one page that is about somebody other than the
  // owner, and there is nobody to put on an admin that does not exist yet.
  { to: "people", label: "People", icon: "users" },
] as const;

/** One row of the sidebar's list, whether it is a link, a button or off. */
const ROW = [
  "flex h-nav items-center gap-2 rounded-md px-2 text-nav outline-none",
  "transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
].join(" ");

const AT_REST =
  "font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-strong";

export interface ProjectNavProps {
  project: ProjectDto | undefined;
  user: UserDto | null;
}

/**
 * The project's own navigation: which project, where in it, and who is signed
 * in. It is the runtime's sidebar anatomy (DESIGN.md §3, §6) with the console's
 * two groups in place of the definition's — `Project`, and the `Account` pair
 * that is about the person rather than the project.
 */
export function ProjectNav({ project, user }: ProjectNavProps) {
  return (
    // No ground of its own: the shell paints one surface under the sidebar and
    // the panel's margin alike, so there is no seam between them.
    <aside className="flex w-sidebar-narrow flex-none flex-col p-2 pb-2.5 wide:w-sidebar">
      <ProjectSwitcher project={project} />

      <Rule />

      <nav className="flex-1 overflow-auto pt-0.5" aria-label="Project">
        <Group label="Project">
          {PAGES.map((page) => (
            <li key={page.to}>
              <NavLink
                to={page.to}
                className={({ isActive }) =>
                  cn(ROW, isActive ? "bg-sidebar-accent font-semibold text-sidebar-strong" : AT_REST)
                }
              >
                {/* The glyph is set in its own label's ink: it is how the eye
                    finds the word, and a dimmed mark is harder to find. */}
                <ResourceIcon name={page.icon} className="size-4 flex-none" />
                <span className="truncate">{page.label}</span>
              </NavLink>
            </li>
          ))}
        </Group>

        <Group label="Account">
          <li>
            {/*
             * Drawn rather than hidden. Project rename and delete are task
             * 014's binding out-of-scope, and a nav that hides what does not
             * exist yet teaches the wrong shape of the product; one that shows
             * it off says "later", which is true.
             */}
            <span aria-disabled className={cn(ROW, "font-medium text-sidebar-muted")}>
              <ResourceIcon name="settings" className="size-4 flex-none" />
              <span className="truncate">Settings</span>
              <span className="ml-auto text-micro font-medium">Soon</span>
            </span>
          </li>
          <li>
            <SignOutButton className={cn(ROW, AT_REST, "w-full justify-start px-2")}>
              <SignOutIcon className="size-4 flex-none" />
              <span className="truncate">Sign out</span>
            </SignOutButton>
          </li>
        </Group>
      </nav>

      <Rule />

      <div className="flex h-11 items-center gap-2.5 rounded-md px-2">
        <div className="grid size-[26px] flex-none place-items-center rounded-lg bg-sidebar-accent text-micro font-semibold text-sidebar-strong">
          {initials(user)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-body leading-tight font-medium text-sidebar-strong">
            {user?.name ?? "Signed in"}
          </div>
          <div className="truncate text-nav-meta leading-snug text-sidebar-muted">{user?.email}</div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Which project this is, and the way to another one. The runtime gives this
 * slot the app's name; a console is always inside one project out of several,
 * so the slot is the way back to the list that chooses between them.
 */
function ProjectSwitcher({ project }: { project: ProjectDto | undefined }) {
  return (
    <Link
      to="/"
      aria-label="Switch project"
      className="flex h-11 items-center gap-2.5 rounded-md px-2 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/45"
    >
      <div className="grid size-[22px] flex-none place-items-center rounded-md bg-primary text-micro font-semibold text-primary-foreground">
        {(project?.name ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        {project ? (
          <>
            <div className="truncate text-brand leading-tight font-semibold tracking-[-0.01em] text-sidebar-strong">
              {project.name}
            </div>
            <div className="truncate font-data text-nav-meta leading-snug text-sidebar-muted">
              {project.key}
            </div>
          </>
        ) : (
          <Skeleton className="h-4 w-28" />
        )}
      </div>
      <ChevronDownIcon className="size-3.5 flex-none text-sidebar-muted" />
    </Link>
  );
}

/**
 * A named list. The label is smaller *and* dimmer than what it names, which is
 * the whole of what makes it read as a label rather than as another
 * destination (DESIGN.md §3).
 */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-2 pt-4 pb-2 text-micro font-semibold tracking-[0.02em] text-sidebar-muted">
        {label}
      </div>
      <ul className="flex list-none flex-col gap-nav-gap p-0">{children}</ul>
    </div>
  );
}

function Rule() {
  return <div className="mx-2 my-1.5 h-px flex-none bg-sidebar-border" />;
}

function initials(user: UserDto | null): string {
  const source = user?.name ?? user?.email ?? "";
  const parts = source.split(/[\s.@]+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("") || "?";
}
