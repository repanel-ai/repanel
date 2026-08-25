import { Button, Card, FormError, Input, Label } from "@repanel/ui";
import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { messageOf } from "../../lib/api-client";
import { useAuth } from "./use-auth";

/**
 * Where signing in leads: the address the guard was protecting, or the
 * projects list. Only a path within the console is accepted — a destination is
 * a place in this app, and anything else is somebody else's idea of one.
 */
function intendedFrom(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) return "/";
  return from;
}

export function LoginPage() {
  const navigate = useNavigate();
  const returnTo = intendedFrom(useLocation().state);
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(returnTo, { replace: true }) });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <h1 className="text-lg font-medium">Sign in to RePanel</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <FormError message={messageOf(login.error)} />
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
