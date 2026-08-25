import {
  ACTIVITY_PAGE_SIZE,
  type ActivityEventDto,
  type AuditOutcome,
  type Field,
  type JsonValue,
  type RecordId,
  type Resource,
} from "@repanel/contracts";
import {
  Badge,
  EmptyPanel,
  NoValue,
  Section,
  Skeleton,
  TONE_INK,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  type BadgeTone,
} from "@repanel/ui";
import { useState } from "react";
import { ApiError } from "../../lib/api-client";
import { DateValue } from "./date-value";
import { ErrorState } from "./error-state";
import { Pagination } from "./pagination";
import { useActivity } from "./use-runtime";

/**
 * How an outcome is drawn. The vocabulary is RePanel's own rather than a
 * customer's, which is why the runtime may tone it at all — the rule that
 * severity is never guessed is a rule about *their* values (DECISIONS #029),
 * and these three are ours.
 *
 * A success wears nothing. Almost every line of a healthy log is one, and a
 * column of identical badges is a column that has stopped saying anything; the
 * lines worth finding are the two that did not go through.
 */
const OUTCOME_TONE: Record<Exclude<AuditOutcome, "ok">, BadgeTone> = {
  refused: "attention",
  failed: "critical",
};

/** As many placeholder rows as the page it is standing in for will hold. */
const PENDING_ROWS = ACTIVITY_PAGE_SIZE;

export interface ActivityListProps {
  projectKey: string;
  /** The resource the record belongs to. Its fields name what an event moved. */
  resource: Resource;
  recordId: RecordId;
  /**
   * Whether the list has to name itself. Inside a tab it does not: the tab has
   * already named it, and saying it twice is saying it once too often.
   */
  titled?: boolean;
}

/**
 * What has been done to this record, newest first.
 *
 * It is a related list in every way but one: what is under it belongs to *this*
 * record, so the heading does not wear §5's dotted rule. That mark means "this
 * belongs to a different record" and it means it everywhere — putting it on a
 * record's own history would be a lie told in the one place the product asks to
 * be trusted.
 */
export function ActivityList({ projectKey, resource, recordId, titled = true }: ActivityListProps) {
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(ACTIVITY_PAGE_SIZE),
  }).toString();
  const activity = useActivity(projectKey, resource.key, recordId, query);

  const total = activity.data?.total ?? 0;
  const events = activity.data?.events ?? [];
  const count = activity.data
    ? `${total.toLocaleString()} ${total === 1 ? "event" : "events"}`
    : undefined;

  const body = activity.isError ? (
    <ErrorState
      title="Activity could not be read"
      message={
        activity.error instanceof ApiError
          ? activity.error.message
          : "Something went wrong reading this record's activity."
      }
      onRetry={() => void activity.refetch()}
    />
  ) : (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border">
      <div className={cn("min-h-0", activity.isPending ? "overflow-hidden" : "overflow-auto")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-head-compact">When</TableHead>
              <TableHead className="h-head-compact">Event</TableHead>
              <TableHead className="h-head-compact">Change</TableHead>
              <TableHead className="h-head-compact">By</TableHead>
            </TableRow>
          </TableHeader>

          {activity.isPending ? (
            <PendingRows />
          ) : (
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="h-row-compact">
                    <DateValue
                      value={event.at}
                      hasTime
                      showClock
                      className="text-muted-foreground"
                    />
                  </TableCell>
                  <TableCell className="h-row-compact">
                    <Happened resource={resource} event={event} />
                  </TableCell>
                  <TableCell className="h-row-compact">
                    <Changed resource={resource} event={event} />
                  </TableCell>
                  <TableCell className="h-row-compact font-data text-muted-foreground">
                    {event.actorEmail}
                  </TableCell>
                </TableRow>
              ))}

              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-auto border-b-0">
                    <EmptyPanel
                      className="py-10"
                      title="No activity"
                      description={`Nothing has been done to this ${resource.label.singular.toLowerCase()} through this admin yet.`}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          )}
        </Table>
      </div>

      {total > ACTIVITY_PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={ACTIVITY_PAGE_SIZE}
          total={total}
          count={events.length}
          onPage={setPage}
        />
      )}
    </div>
  );

  return titled ? (
    <Section title="Activity" meta={count}>
      {body}
    </Section>
  ) : (
    <div className="flex min-w-0 flex-col gap-2">
      {count && <p className="text-small text-muted-foreground">{count}</p>}
      {body}
    </div>
  );
}

/**
 * What was done, in the definition's own word for it where there is one: an
 * action is named by the label on the button somebody pressed, so the log reads
 * back the way the admin reads. A write has no such word, because a form is the
 * runtime's own screen.
 */
function Happened({ resource, event }: { resource: Resource; event: ActivityEventDto }) {
  return (
    <span className="inline-flex items-center gap-2">
      {nameOf(resource, event)}
      {event.outcome !== "ok" && (
        <Badge tone={OUTCOME_TONE[event.outcome]}>{said(event.reason ?? event.outcome)}</Badge>
      )}
    </span>
  );
}

function nameOf(resource: Resource, event: ActivityEventDto): string {
  if (event.kind === "create") return "Created";
  if (event.kind === "update") return "Edited";

  const action = resource.actions.find((candidate) => candidate.key === event.actionKey);
  // An action the definition no longer declares still happened, and its key is
  // the truest name left for it.
  return action?.label ?? event.actionKey ?? "Action";
}

/**
 * What moved, field by field. A refusal moved nothing and says so with the same
 * mark every other absence in this admin uses; so does an action that ran
 * inside the customer's application, where what changed is theirs to log.
 */
function Changed({ resource, event }: { resource: Resource; event: ActivityEventDto }) {
  const keys = Object.keys(event.after ?? event.before ?? {});
  if (keys.length === 0) return <NoValue />;

  return (
    <span className="inline-flex items-baseline gap-3">
      {keys.map((key) => {
        const field = resource.fields.find((candidate) => candidate.key === key);

        return (
          <span key={key} className="inline-flex items-baseline gap-1.5">
            <span className="text-muted-foreground">{field?.label ?? key}</span>
            {event.before && (
              <>
                <Value field={field} value={event.before[key]} />
                <span className="text-muted-foreground" aria-hidden="true">
                  →
                </span>
                <span className="sr-only">became</span>
              </>
            )}
            <Value field={field} value={event.after?.[key]} />
          </span>
        );
      })}
    </span>
  );
}

/**
 * One value a write set, or replaced. It is set in the data face and left
 * alone: a badge, a link and a formatted day are treatments for what a record
 * *is*, and a line of a log is a note about what a column held.
 *
 * The one exception is the one the form already makes — an enum wears the tone
 * the definition gave it, as ink rather than as a fill (DECISIONS #057), so the
 * line an operator opened this panel to find reads at a glance.
 */
function Value({ field, value }: { field?: Field; value: JsonValue | undefined }) {
  if (value === null || value === undefined) return <NoValue />;

  const tone = field?.type === "enum" ? field.tones[String(value)] : undefined;

  return (
    <span className={cn("font-data", tone && TONE_INK[tone])}>
      {typeof value === "object" ? JSON.stringify(value) : String(value)}
    </span>
  );
}

/** A category, said rather than spelled: `action_rejected` reads as words. */
function said(code: string): string {
  return code.replace(/_/g, " ");
}

/**
 * The shape of the page while it is on its way. The columns are fixed, so they
 * are already drawn; only the lines are missing, and the panel says so without
 * saying anything to a screen reader.
 */
function PendingRows() {
  const widths = ["58%", "44%", "70%", "62%"];

  return (
    <tbody aria-hidden="true">
      {Array.from({ length: PENDING_ROWS }, (_, row) => (
        <tr key={row}>
          {widths.map((width, cell) => (
            <td key={cell} className="h-row-compact border-b border-border px-2.5 align-middle">
              <Skeleton className="h-3" style={{ width: widths[(row + cell) % widths.length] ?? width }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
