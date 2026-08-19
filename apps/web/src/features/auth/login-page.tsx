import { Button, Card, FormError, Input, Label } from "@repanel/ui";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "./use-auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate("/", { replace: true }) });
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
          <FormError message={messageFor(login.error)} />
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

/** The API's own words when it has any; ours when the request never got there. */
function messageFor(error: Error | null): string | null {
  if (error === null) return null;
  return error instanceof ApiError ? error.message : "Could not reach RePanel. Try again.";
}
