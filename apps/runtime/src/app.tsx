import { Toaster } from "@repanel/ui";
import { Route, Routes, useParams } from "react-router";
import { CONSOLE_URL } from "./config/env";
import { RuntimeShell } from "./features/runtime/runtime-shell";
import { SessionGate } from "./features/session/session-gate";

/**
 * The whole of the rendered admin, under the one stack its notices are raised
 * into. The stack wraps the router rather than sitting on a screen, because a
 * notice is about something that has already happened and has to outlive
 * whatever raised it — including a screen that navigates away, and an action
 * row that a success takes off the page (DECISIONS #050).
 */
export function App() {
  return (
    <Toaster>
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
    </Toaster>
  );
}

/** The rendered admin for the project the address names. */
function Admin() {
  const { projectKey = "" } = useParams();
  return <RuntimeShell projectKey={projectKey} />;
}
