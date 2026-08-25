import type { DraftStatusDto } from "@repanel/contracts";
import { Button, Card, Dialog } from "@repanel/ui";
import { useState } from "react";
import { messageOf } from "../../lib/api-client";
import { formatMoment } from "../../lib/format-date";
import { DefinitionErrors } from "./definition-errors";
import { usePublishDefinition } from "./use-definition-status";

/** A draft that exists. The page answers "nothing submitted" on its own. */
export type SubmittedDraft = Exclude<DraftStatusDto, { status: "none" }>;

export interface DraftDefinitionProps {
  projectId: string;
  draft: SubmittedDraft;
  /** Whether this draft is newer than the version being served. */
  unpublishedChanges: boolean;
}

/**
 * The definition being worked on, and the one decision a human makes about it.
 *
 * Publishing is offered whenever there is a draft, and refused in place rather
 * than hidden when it cannot be done: a button that is not there teaches
 * nothing, and the reason it is disabled is the thing the human came to find
 * out (`project-nav.tsx` says "Soon" for the same reason).
 */
export function DraftDefinition({ projectId, draft, unpublishedChanges }: DraftDefinitionProps) {
  const [confirming, setConfirming] = useState(false);
  const publish = usePublishDefinition(projectId);
  const refusal = reasonNotToPublish(draft, unpublishedChanges);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-body font-medium">Draft</span>
          <span className="text-body text-muted-foreground">
            {draft.status === "valid"
              ? `Submitted ${formatMoment(draft.updatedAt)}`
              : "The last definition your agent submitted did not validate."}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1">
          <Button disabled={refusal !== null} onClick={() => setConfirming(true)}>
            Publish draft
          </Button>
          {refusal && <span className="text-small text-muted-foreground">{refusal}</span>}
        </div>
      </div>

      {draft.status === "invalid" && (
        <>
          <p className="text-body text-muted-foreground">
            It is stored as it was sent, so nothing is lost — the agent can read these problems
            back and repair it. Nothing was published: what your operators are being served is
            whatever it was before.
          </p>
          <DefinitionErrors errors={draft.errors} />
        </>
      )}

      <Dialog
        open={confirming}
        title="Publish this draft?"
        confirmLabel="Publish"
        pending={publish.isPending ? "Publishing…" : undefined}
        onConfirm={() =>
          publish.mutate(undefined, { onSuccess: () => setConfirming(false) })
        }
        onCancel={() => {
          publish.reset();
          setConfirming(false);
        }}
      >
        Everyone using this admin sees this definition as soon as you publish it.
        {messageOf(publish.error) && (
          <span role="alert" className="mt-2 block text-small text-destructive-text">
            {messageOf(publish.error)}
          </span>
        )}
      </Dialog>
    </Card>
  );
}

/**
 * Why this draft cannot be published, or null when it can. One sentence, said
 * next to the control it disables — the two are useless apart.
 */
function reasonNotToPublish(draft: SubmittedDraft, unpublishedChanges: boolean): string | null {
  if (draft.status === "invalid") {
    const problems = `${draft.errorCount} ${draft.errorCount === 1 ? "problem" : "problems"}`;
    return `Publishing needs a draft that validates — ${problems} below.`;
  }
  if (!unpublishedChanges) return "Nothing new to publish — this draft is already live.";
  return null;
}
