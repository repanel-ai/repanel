import type { Action, RecordId, Resource } from "@repanel/contracts";
import { Button, Dialog, Toast, ToastViewport } from "@repanel/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { useRunAction } from "./use-runtime";

/**
 * How long a success stays up. A failure has no timer at all: the operator has
 * to be able to read what went wrong, and something they have to read is
 * something they get to dismiss.
 */
const ACKNOWLEDGED_MS = 5_000;

/** One notice about something that has already happened, and how it is said. */
interface Notice {
  id: number;
  tone: "positive" | "critical";
  title: string;
  description?: string;
}

export interface RecordActionsProps {
  projectKey: string;
  resource: Resource;
  recordId: RecordId;
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
 */
export function RecordActions({ projectKey, resource, recordId }: RecordActionsProps) {
  const [asking, setAsking] = useState<Action | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextNotice = useRef(0);
  const run = useRunAction(projectKey, resource.key, recordId);

  const dismiss = useCallback(
    (id: number) => setNotices((open) => open.filter((notice) => notice.id !== id)),
    [],
  );

  const announce = (notice: Omit<Notice, "id">) => {
    nextNotice.current += 1;
    setNotices((open) => [...open, { ...notice, id: nextNotice.current }]);
  };

  const confirm = (action: Action) => {
    run.mutate(action.key, {
      onSuccess: (result) => {
        setAsking(null);
        // The definition's own word for it, so the notice is headed the way the
        // button that caused it was.
        announce({ tone: "positive", title: `${result.label} done` });
      },
      onError: (error) => {
        setAsking(null);
        announce({
          tone: "critical",
          title: `${action.label} failed`,
          // The API's words. The runtime has nothing to add: whatever failed
          // happened on the far side of it.
          description:
            error instanceof ApiError ? error.message : "Something went wrong running this action.",
        });
      },
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {resource.actions.map((action) => (
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

      <ToastViewport>
        {notices.map((notice) => (
          <Acknowledgement key={notice.id} notice={notice} onDismiss={dismiss} />
        ))}
      </ToastViewport>
    </>
  );
}

/** A notice, and — for one that went well — the clock it goes away on. */
function Acknowledgement({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: (id: number) => void;
}) {
  const { id, tone } = notice;

  useEffect(() => {
    if (tone !== "positive") return;
    const timer = window.setTimeout(() => onDismiss(id), ACKNOWLEDGED_MS);
    return () => window.clearTimeout(timer);
  }, [id, tone, onDismiss]);

  return (
    <Toast
      tone={tone}
      title={notice.title}
      description={notice.description}
      onDismiss={() => onDismiss(id)}
    />
  );
}
