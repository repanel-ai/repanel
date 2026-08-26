import { Toaster } from "@repanel/ui";
import { Navigate, Route, Routes } from "react-router";
import { API_URL, RUNTIME_URL } from "./config/env";
import { AgentAccessPage } from "./features/agent-access/agent-access-page";
import { LoginPage } from "./features/auth/login-page";
import { RequireAuth } from "./features/auth/require-auth";
import { AuthorizeCliPage } from "./features/cli/authorize-cli-page";
import { ConnectionPage } from "./features/connection/connection-page";
import { DefinitionPage } from "./features/definition/definition-page";
import { PeoplePage } from "./features/people/people-page";
import { Landing } from "./features/projects/landing";
import { OverviewPage } from "./features/projects/overview-page";
import { ProjectShell } from "./project-shell";

/**
 * A project is five pages, and which one you are on lives in the address. That
 * is the same rule the runtime keeps for a table's filters and a record's tabs
 * (DESIGN.md §9): a screen you can link to, go back from and reload into.
 *
 * The whole of it sits under one notice stack. Almost nothing in the console
 * needs it — every form's failure belongs beside the control that caused it,
 * and every one of them has a place there — but an outcome whose own screen is
 * gone by the time it is known has nowhere else to be said (DECISIONS #050).
 */
export function App() {
  return (
    <Toaster>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Where `repanel link` sends the browser: a session for the machine the
            address names, and nothing else. Outside the console shell, because
            it is an errand rather than a place. */}
        <Route
          path="/cli"
          element={
            <RequireAuth>
              <AuthorizeCliPage />
            </RequireAuth>
          }
        />

        {/* Where signing in lands. What is drawn depends on what this account
            may reach: the console for an owner, the admin itself for somebody
            who only operates one (task 029). */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Landing runtimeUrl={RUNTIME_URL} />
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
          <Route path="people" element={<PeoplePage />} />
        </Route>
      </Routes>
    </Toaster>
  );
}
