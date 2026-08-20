import type { NavigationGroup, Resource, UserDto } from "@repanel/contracts";
import { ResourceIcon } from "@repanel/ui";
import { NavLink } from "react-router";
import { runtimeRoutes } from "./routes";

export interface SidebarProps {
  appName: string;
  projectKey: string;
  navigation: NavigationGroup[];
  /** Every resource the definition declares, by key. */
  resources: ReadonlyMap<string, Resource>;
  user: UserDto | null;
}

/**
 * The admin's own navigation, built from the definition's groups and nothing
 * else — including the mark beside each resource, which the definition names
 * out of a fixed vocabulary (DECISIONS #031). Nothing here reads a resource
 * key and decides what it looks like.
 */
export function Sidebar({ appName, projectKey, navigation, resources, user }: SidebarProps) {
  return (
    // No ground of its own: the shell paints one surface under the sidebar and
    // the panel's margin alike, so there is no seam between them.
    <aside className="flex w-sidebar-narrow flex-none flex-col p-2 pb-2.5 wide:w-sidebar">
      <div className="flex h-11 items-center gap-2.5 px-2">
        <div className="grid size-[22px] flex-none place-items-center rounded-md bg-primary text-micro font-semibold text-primary-foreground">
          {appName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-brand leading-tight font-semibold tracking-[-0.01em]">
            {appName}
          </div>
          <div className="truncate text-nav-meta leading-snug text-sidebar-muted">{projectKey}</div>
        </div>
      </div>

      <Rule />

      <nav className="flex-1 overflow-auto pt-0.5" aria-label="Resources">
        {navigation.map((group) => (
          <div key={group.label}>
            {/* It names the list; it is not in it, so it is smaller and sits
                a step behind what it names. */}
            <div className="px-2 pt-3.5 pb-1 text-micro font-semibold tracking-[0.02em] text-sidebar-muted">
              {group.label}
            </div>
            <ul className="flex list-none flex-col gap-px p-0">
              {group.resources.map((key) => (
                <li key={key}>
                  <NavLink
                    to={runtimeRoutes.resource(projectKey, key)}
                    className={({ isActive }) =>
                      [
                        "flex h-nav items-center gap-2 rounded-md px-2 text-body font-medium outline-none",
                        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                        isActive
                          ? "bg-sidebar-accent text-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
                      ].join(" ")
                    }
                  >
                    <ResourceIcon
                      name={resources.get(key)?.icon ?? "table"}
                      // A step behind the name it marks: the word is what is
                      // being read, and the glyph is how the eye finds it.
                      className="size-4 flex-none opacity-70"
                    />
                    <span className="truncate">{resources.get(key)?.label.plural ?? key}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Rule />

      <div className="flex h-11 items-center gap-2.5 rounded-md px-2">
        <div className="grid size-[26px] flex-none place-items-center rounded-lg bg-secondary text-micro font-semibold text-secondary-foreground">
          {initials(user)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-body leading-tight font-medium">{user?.name ?? "Signed in"}</div>
          <div className="truncate text-nav-meta leading-snug text-sidebar-muted">{user?.email}</div>
        </div>
      </div>
    </aside>
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
