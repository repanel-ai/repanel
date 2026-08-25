import type { Definition } from "@repanel/contracts";
import { Button, cn } from "@repanel/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useMatch } from "react-router";
import { ApiError } from "../../lib/api-client";
import { useSession } from "../session/use-session";
import { ErrorState } from "./error-state";
import { FormPage } from "./form-page";
import { RecordPage } from "./record-page";
import { Sidebar } from "./sidebar";
import { TablePage } from "./table-page";
import { ThemeToggle } from "./theme-toggle";
import { runtimeKeys, useDefinition } from "./use-runtime";
import { useTheme } from "./use-theme";

/**
 * The one surface every screen sits on: the chrome, falling slightly from top to
 * bottom, under the sidebar and the panel's margin alike.
 */
const GROUND = "bg-linear-to-b from-sidebar-top to-sidebar-bottom";

/**
 * The admin an operator works inside: navigation on the left, one screen on the
 * right, and a definition that decides both. Nothing here knows what a resource
 * is called — everything on screen was read out of the project's definition.
 */
export function RuntimeShell({ projectKey }: { projectKey: string }) {
  const { theme, toggle } = useTheme();
  const definition = useDefinition(projectKey);
  const { user } = useSession();
  const client = useQueryClient();
  const onResource = useMatch("/a/:projectKey/r/:resourceKey/*");

  if (definition.isPending) {
    return (
      <div className={cn("flex h-screen items-center justify-center", GROUND)}>
        <span role="status" className="text-small text-muted-foreground">
          Loading admin
        </span>
      </div>
    );
  }

  if (definition.isError || !definition.data) {
    return (
      <div className={cn("flex h-screen items-center justify-center p-6", GROUND)}>
        <div className="w-full max-w-md">
          <ErrorState
            title="This admin could not be loaded"
            message={
              definition.error instanceof ApiError
                ? definition.error.message
                : "The definition for this project could not be read."
            }
            onRetry={() => void definition.refetch()}
          />
        </div>
      </div>
    );
  }

  const admin = definition.data;
  const resources = new Map(admin.resources.map((resource) => [resource.key, resource]));
  const current = onResource?.params.resourceKey;

  return (
    <div className={cn("flex h-screen overflow-hidden", GROUND)}>
      <Sidebar
        appName={admin.app.name}
        projectKey={projectKey}
        navigation={admin.navigation}
        resources={resources}
        user={user}
      />

      <main className="m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-background">
        <div className="flex h-top flex-none items-center gap-2.5 border-b border-border px-4">
          <p className="truncate text-small text-muted-foreground">
            {groupOf(admin, current) && (
              <>
                {groupOf(admin, current)} <span className="opacity-50">/</span>{" "}
              </>
            )}
            <span className="font-medium text-foreground">
              {current ? (resources.get(current)?.label.plural ?? current) : admin.app.name}
            </span>
          </p>
          <div className="flex-1" />
          <ThemeToggle theme={theme} onToggle={toggle} />
          <Button
            variant="outline"
            onClick={() => void client.invalidateQueries({ queryKey: runtimeKeys.project(projectKey) })}
            className="text-utility-foreground hover:text-foreground"
          >
            Refresh
          </Button>
        </div>

        <Routes>
          <Route index element={<Navigate to={firstResourcePath(admin)} replace />} />
          <Route
            path="r/:resourceKey"
            element={<TablePage projectKey={projectKey} definition={admin} />}
          />
          {/* A static segment outranks a dynamic one, so `new` is the form
              and never a record whose key happens to be that word. */}
          <Route
            path="r/:resourceKey/new"
            element={<FormPage projectKey={projectKey} definition={admin} mode="create" />}
          />
          <Route
            path="r/:resourceKey/:recordId"
            element={<RecordPage projectKey={projectKey} definition={admin} />}
          />
          <Route
            path="r/:resourceKey/:recordId/edit"
            element={<FormPage projectKey={projectKey} definition={admin} mode="update" />}
          />
        </Routes>
      </main>
    </div>
  );
}

/** Which group a resource is filed under, for the breadcrumb. */
function groupOf(admin: Definition, resourceKey: string | undefined): string | undefined {
  if (!resourceKey) return undefined;
  return admin.navigation.find((group) => group.resources.includes(resourceKey))?.label;
}

/**
 * An admin opens on the first thing its navigation names. There is no dashboard
 * to land on, and a landing page nobody asked for is a screen to maintain.
 */
function firstResourcePath(admin: Definition): string {
  return `r/${admin.navigation[0]?.resources[0] ?? admin.resources[0]?.key ?? ""}`;
}
