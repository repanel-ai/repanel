import { Route, Routes } from "react-router";
import { LoginPage } from "./features/auth/login-page";
import { RequireAuth } from "./features/auth/require-auth";
import { SignOutButton } from "./features/auth/sign-out-button";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Placeholder>Projects</Placeholder>
          </RequireAuth>
        }
      />
      <Route
        path="/p/:id"
        element={
          <RequireAuth>
            <Placeholder>Project</Placeholder>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

/** Stands in until the real console screens arrive in task 014. */
function Placeholder({ children }: { children: string }) {
  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-6">
      <p>{children} — built in task 014.</p>
      <SignOutButton />
    </main>
  );
}
