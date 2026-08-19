import { Route, Routes, useParams } from "react-router";
import { RuntimeShell } from "./features/runtime/runtime-shell";
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
            <Admin />
          </SessionGate>
        }
      />
    </Routes>
  );
}

/** The rendered admin for the project the address names. */
function Admin() {
  const { projectKey = "" } = useParams();
  return <RuntimeShell projectKey={projectKey} />;
}
