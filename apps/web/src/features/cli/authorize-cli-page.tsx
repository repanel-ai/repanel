import { Button, Card, FormError } from "@repanel/ui";
import { useSearchParams } from "react-router";
import { messageOf } from "../../lib/api-client";
import { useAuth } from "../auth/use-auth";
import { callbackUrl } from "./callback";
import { useAuthorizeCli } from "./use-authorize-cli";

/**
 * Where a human signs the `repanel` CLI on their machine in.
 *
 * The CLI cannot authenticate anybody — it has no password field and must
 * never have one — so it sends the browser here, where a session already
 * exists, and waits on a loopback port. This page mints a session against that
 * session and hands it straight back to that port. Nothing else is exchanged:
 * the connection string the CLI goes on to send is read from the developer's
 * own environment and never passes through this browser or any agent.
 */
export function AuthorizeCliPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const authorize = useAuthorizeCli();

  const port = params.get("port");
  const state = params.get("state");
  const unreadable = callbackUrl(port, state, "probe") === undefined;

  function approve() {
    authorize.mutate(undefined, {
      onSuccess: ({ token }) => {
        const callback = callbackUrl(port, state, token);
        // Replaced rather than pushed: the address the token is carried on has
        // no business being one press of the back button away.
        if (callback) window.location.replace(callback);
      },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card className="flex flex-col gap-4 p-5">
        <h1 className="text-lg font-medium">Authorize the RePanel CLI</h1>

        {unreadable ? (
          <p className="text-body text-muted-foreground">
            This page was not opened by the RePanel CLI: it carries no machine to answer. Run{" "}
            <span className="font-data">repanel link</span> and follow the link it prints.
          </p>
        ) : (
          <>
            <p className="text-body text-muted-foreground">
              The <span className="font-data">repanel</span> command line on this machine is asking
              to act as {user?.email ?? "you"}: to read your projects, connect a database to one,
              and submit definitions.
            </p>
            <p className="text-small text-muted-foreground">
              It is handed a session, not your password, and only this machine receives it.
            </p>
            <FormError message={messageOf(authorize.error)} />
            <Button onClick={approve} disabled={authorize.isPending || authorize.isSuccess}>
              {authorize.isPending || authorize.isSuccess ? "Authorizing…" : "Authorize"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
