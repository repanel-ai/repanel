import { Route, Routes, useParams } from "react-router";
import { SessionGate } from "./features/session/session-gate";

/** Where an operator signs in; the runtime has no login screen of its own. */
const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL ?? "http://localhost:5173";

export function App() {
  return (
    <Routes>
      <Route
        path="/a/:projectKey/*"
        element={
          <SessionGate consoleUrl={CONSOLE_URL}>
            <RuntimePlaceholder />
          </SessionGate>
        }
      />
    </Routes>
  );
}

/** Stands in until the renderer itself arrives in task 010. */
function RuntimePlaceholder() {
  const { projectKey } = useParams();

  return (
    <main className="flex min-h-screen flex-col items-start gap-2 p-6">
      <p>Runtime shell — built in task 010.</p>
      <p className="text-muted-foreground">Project: {projectKey}</p>
    </main>
  );
}
