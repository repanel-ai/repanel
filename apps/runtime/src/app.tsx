import { Route, Routes, useParams } from "react-router";
import { CONSOLE_URL } from "./config/env";
import { RuntimeShell } from "./features/runtime/runtime-shell";
import { SessionGate } from "./features/session/session-gate";

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
