import type { Action, RecordId } from "@repanel/contracts";
import { Button, Dialog, useToaster, type ToastMessage } from "@repanel/ui";
import { useState } from "react";
import { ApiError } from "../../lib/api-client";
import { useRunAction } from "./use-runtime";

/**
 * What to tell somebody whose action was refused the way an unverified request
 * is refused.
 *
 * RePanel signs every outbound action (docs/SIGNING.md), and an application
 * that answers 401 or 403 is usually one that has not been given the secret to
 * check it with. On a developer's own machine that secret is the one
 * `repanel dev` printed when it booted, and it is generated per run — so it is
 * new every time, and this is the sentence that says where to find it.
 *
 * It hedges because the runtime genuinely cannot know: `repanel dev` serves the
 * same bundle the hosted product serves (`packages/cli/src/dev/spa.ts`), and a
 * screen that guessed would be telling half its operators something false.
 */
const DEV_SECRET_HINT = "If running locally: set the dev action secret printed at repanel dev's boot.";

export interface RecordActionsProps {
  projectKey: string;
  resourceKey: string;
  recordId: RecordId;
  /** The ones this record is offered — which is not always all of them. */
  actions: readonly Action[];
}

/**
 * What an operator may do to this record, and the asking that comes first.
 *
 * Every action is drawn the same way, in the order the definition lists them.
 * The runtime does not decide that one of them is the important one or that
 * another is dangerous — nothing in the schema says so, and reading severity
 * out of a label is the same guess the badge language refuses to make
 * (DECISIONS #029). What the definition does say is `confirm`, and that
 * sentence is the whole of the dialog: it is the author's warning, in the
 * author's words, and the runtime adds nothing to it.
 *
 * The notice about how it went is raised into the app's own stack rather than
 * held here, because a success can take this whole component off the screen: an
 * action the record has moved past stops being offered, and a record with
 * nothing left to do to it wears no action row at all (DECISIONS #050).
 */
export function RecordActions({ projectKey, resourceKey, recordId, actions }: RecordActionsProps) {
  const [asking, setAsking] = useState<Action | null>(null);
  const { notify } = useToaster();
  const run = useRunAction(projectKey, resourceKey, recordId);

  const confirm = (action: Action) => {
    run.mutate(action.key, {
      onSuccess: (result) => {
        setAsking(null);
        // The definition's own word for it, so the notice is headed the way the
        // button that caused it was.
        notify({ tone: "positive", title: `${result.label} done` });
      },
      onError: (error) => {
        setAsking(null);
        notify(failureNotice(action, error));
      },
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button key={action.key} variant="outline" onClick={() => setAsking(action)}>
            {action.label}
          </Button>
        ))}
      </div>

      {/* Nothing is being asked, so there is no question on the page. */}
      {asking && (
        <Dialog
          open
          title={asking.label}
          confirmLabel={asking.label}
          pending={run.isPending ? "Running…" : undefined}
          onConfirm={() => confirm(asking)}
          onCancel={() => setAsking(null)}
        >
          {asking.confirm}
        </Dialog>
      )}
    </>
  );
}

/**
 * How an action that did not go through is said.
 *
 * The first line is the API's words and nothing else: whatever failed happened
 * on the far side of the runtime, which has no account of it to add. The second
 * is the one thing it can add — the likeliest reason for this particular
 * refusal, on the one machine where the fix is a line in a terminal.
 */
function failureNotice(action: Action, error: unknown): ToastMessage {
  const message =
    error instanceof ApiError ? error.message : "Something went wrong running this action.";

  return {
    tone: "critical",
    title: `${action.label} failed`,
    description: unverified(error) ? (
      <>
        {message}
        <span className="mt-1 block text-muted-foreground">{DEV_SECRET_HINT}</span>
      </>
    ) : (
      message
    ),
  };
}

/**
 * Whether the application refused the call the way it refuses one it cannot
 * verify.
 *
 * The status is read out of the sentence the engine wrote, which is the only
 * place it survives: what reaches a browser is one of four coarse categories,
 * and a customer's own response body is never forwarded through them
 * (`ActionFailureCode`, and DESIGN.md §10). `packages/engine`'s http-call spec
 * holds that sentence to naming the status, from the other end.
 */
function unverified(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === "action_rejected" &&
    /\banswered (?:401|403)\b/.test(error.message)
  );
}
