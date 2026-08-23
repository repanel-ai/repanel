import { Route, Routes } from "react-router";
import { ConsoleShell } from "./console-shell";
import { LoginPage } from "./features/auth/login-page";
import { RequireAuth } from "./features/auth/require-auth";
import { ProjectPage } from "./features/projects/project-page";
import { ProjectsPage } from "./features/projects/projects-page";

/**
 * Where the API answers from outside the browser. The console itself talks to
 * `/api` through the dev proxy and never uses this — it is what an agent's MCP
 * client has to dial, so it goes into the setup snippet rather than a request.
 */
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Where the rendered admin is served. Dev runs the two apps on two origins
 * (DECISIONS #025), so "Open admin" is an absolute link built from here rather
 * than a route this app knows how to render.
 */
const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL ?? "http://localhost:5174";

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
            <ConsoleShell>
              <ProjectPage apiUrl={API_URL} runtimeUrl={RUNTIME_URL} />
            </ConsoleShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
