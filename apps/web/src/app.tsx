import { Navigate, Route, Routes } from "react-router";
import { API_URL, RUNTIME_URL } from "./config/env";
import { ConsoleShell } from "./console-shell";
import { AgentAccessPage } from "./features/agent-access/agent-access-page";
import { LoginPage } from "./features/auth/login-page";
import { RequireAuth } from "./features/auth/require-auth";
import { ConnectionPage } from "./features/connection/connection-page";
import { DefinitionPage } from "./features/definition/definition-page";
import { OverviewPage } from "./features/projects/overview-page";
import { ProjectsPage } from "./features/projects/projects-page";
import { ProjectShell } from "./project-shell";

/**
 * A project is four pages, and which one you are on lives in the address. That
 * is the same rule the runtime keeps for a table's filters and a record's tabs
 * (DESIGN.md §9): a screen you can link to, go back from and reload into.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <ConsoleShell>
              <ProjectsPage />
            </ConsoleShell>
          </RequireAuth>
        }
      />

      <Route
        path="/p/:id"
        element={
          <RequireAuth>
            <ProjectShell />
          </RequireAuth>
        }
      >
        {/* A project opens on where it stands, which is the only page that
            says what is left to do. */}
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage apiUrl={API_URL} />} />
        <Route path="connection" element={<ConnectionPage />} />
        <Route path="agents" element={<AgentAccessPage apiUrl={API_URL} />} />
        <Route path="definition" element={<DefinitionPage runtimeUrl={RUNTIME_URL} />} />
      </Route>
    </Routes>
  );
}
