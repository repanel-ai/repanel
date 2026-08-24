import { Button, FormError } from "@repanel/ui";
import { messageOf } from "../../lib/api-client";
import { Snippet } from "./snippet";
import { useActionSecret } from "./use-agent-access";

/** Where the scheme this secret signs is written down, in full. */
const SIGNING_DOC = "https://github.com/repanel-ai/repanel/blob/main/docs/SIGNING.md";

/**
 * The key this project's outbound action requests are signed with. It is shown
 * to a signed-in human and nowhere else: the customer's own application needs
 * the same bytes to verify what RePanel sends it (DECISIONS #013), and an agent
 * must never be one of the hands it passes through.
 *
 * It is fetched when it is asked for rather than with the page, so a project
 * page left open is not a page with a secret on it.
 */
export function ActionSecret({ projectId }: { projectId: string }) {
  const secret = useActionSecret(projectId);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-body text-muted-foreground">
        Every action RePanel runs against your application is signed with this secret. Put it
        in your application&rsquo;s own secret store as{" "}
        <code className="font-mono text-small">REPANEL_ACTION_SECRET</code> and verify the
        signature there —{" "}
        <a className="underline underline-offset-2 transition-colors hover:text-foreground" href={SIGNING_DOC}>
          docs/SIGNING.md
        </a>{" "}
        is the scheme.
      </p>

      {secret.data ? (
        <Snippet value={secret.data.secret} what="the action secret" />
      ) : (
        <div>
          <Button
            variant="outline"
            onClick={() => void secret.refetch()}
            disabled={secret.isFetching}
          >
            {secret.isFetching ? "Revealing…" : "Reveal action secret"}
          </Button>
        </div>
      )}

      <FormError message={messageOf(secret.error)} />
    </div>
  );
}
