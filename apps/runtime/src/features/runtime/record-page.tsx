import type { Definition, RecordDto, Resource } from "@repanel/contracts";
import { labelFieldOf } from "@repanel/contracts";
import { ArrowLeftIcon, Badge, CopyButton, FieldRow, Fields, Section } from "@repanel/ui";
import { Link, useLocation, useParams, type To } from "react-router";
import { ApiError } from "../../lib/api-client";
import { DetailValue } from "./detail-value";
import { headerStatusField, relatedListsOf, sectionFields, type RelatedList as Related } from "./detail-layout";
import { ErrorState } from "./error-state";
import { RecordActions } from "./record-actions";
import { RecordNotFound } from "./record-not-found";
import { RecordSkeleton } from "./record-skeleton";
import { DETAILS_TAB, RecordTabs, currentTab } from "./record-tabs";
import { RelatedList } from "./related-list";
import { runtimeRoutes } from "./routes";
import { Screen } from "./screen";
import { useRecord } from "./use-runtime";

/** One record: what it is, what it holds, and what it is connected to. */
export function RecordPage({ projectKey, definition }: { projectKey: string; definition: Definition }) {
  const { resourceKey = "", recordId = "" } = useParams();
  const resource = definition.resources.find((candidate) => candidate.key === resourceKey);

  if (!resource) {
    return (
      <Screen>
        <ErrorState
          title="There is no such screen here"
          message={`This admin has no resource \`${resourceKey}\`.`}
        />
      </Screen>
    );
  }

  // Keyed by the record, so opening a second one starts its related lists on
  // their own first page rather than on the last record's.
  return (
    <RecordScreen
      key={`${resource.key}/${recordId}`}
      projectKey={projectKey}
      definition={definition}
      resource={resource}
      recordId={recordId}
    />
  );
}

function RecordScreen({
  projectKey,
  definition,
  resource,
  recordId,
}: {
  projectKey: string;
  definition: Definition;
  resource: Resource;
  recordId: string;
}) {
  const record = useRecord(projectKey, resource.key, recordId);
  const back = useTableAddress(projectKey, resource.key);
  const location = useLocation();

  const lists = relatedListsOf(definition, resource);
  // Tabs need something to put in a tab; validation refuses the combination,
  // and a definition stored before that rule existed still has to render.
  const tabbed = resource.views.detail.relatedLayout === "tabs" && lists.length > 0;
  const tab = tabbed ? currentTab(location.search, lists) : DETAILS_TAB;
  const open = lists.filter((list) => tab === list.relationship.key);

  return (
    <Screen scrolls>
      <Link
        to={back}
        className={
          "inline-flex w-fit items-center gap-1.5 rounded-sm text-small text-muted-foreground " +
          "outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
        }
      >
        <ArrowLeftIcon className="size-3.5" />
        {resource.label.plural}
      </Link>

      {record.isPending && (
        <>
          <RecordSkeleton resource={resource} />
          <span role="status" className="sr-only">
            Loading record
          </span>
        </>
      )}

      {record.isError &&
        (isMissing(record.error) ? (
          <RecordNotFound resource={resource} back={back} />
        ) : (
          <ErrorState
            title={`This ${resource.label.singular.toLowerCase()} could not be read`}
            message={messageOf(record.error)}
            onRetry={() => void record.refetch()}
          />
        ))}

      {record.data && (
        <>
          <RecordHeader projectKey={projectKey} resource={resource} record={record.data} />

          {tabbed && <RecordTabs lists={lists} current={tab} />}

          {tab === DETAILS_TAB &&
            resource.views.detail.sections.map((section) => {
              const fields = sectionFields(resource, section);
              if (fields.length === 0) return null;

              return (
                <Section key={section.title} title={section.title}>
                  <Fields>
                    {fields.map((field) => (
                      <FieldRow key={field.key} label={field.label}>
                        <DetailValue
                          projectKey={projectKey}
                          field={field}
                          value={record.data.values[field.key] ?? null}
                          isIdentity={field.key === resource.primaryKey}
                        />
                      </FieldRow>
                    ))}
                  </Fields>
                </Section>
              );
            })}

          {/* Inline, every list is on the page under the record's own facts;
              tabbed, only the one whose tab is open. */}
          {(tabbed ? open : lists).map((list: Related) => (
            <RelatedList
              key={list.relationship.key}
              projectKey={projectKey}
              resource={resource}
              recordId={record.data.id}
              relationship={list.relationship}
              target={list.target}
              titled={!tabbed}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

/**
 * What the record is, at a glance: the name a human knows it by, the state it
 * is in, and the key everything else addresses it with. The key is set small
 * and quiet because almost nobody needs it — and copyable because the one who
 * does is about to paste it into a ticket or a query.
 *
 * What can be done to the record sits opposite what it is, on the header rather
 * than on a panel: the header identifies the record and does not move between
 * tabs, and neither does what may be done to it (DESIGN.md §9).
 */
function RecordHeader({
  projectKey,
  resource,
  record,
}: {
  projectKey: string;
  resource: Resource;
  record: RecordDto;
}) {
  const status = headerStatusField(resource);
  const state = status ? record.values[status.key] : undefined;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="text-title font-semibold tracking-[-0.02em]">{nameOf(resource, record)}</h1>
          {status && state !== null && state !== undefined && (
            <Badge tone={status.tones[String(state)]}>{String(state)}</Badge>
          )}
        </div>
        <CopyButton
          value={String(record.id)}
          what={`the ${resource.label.singular.toLowerCase()} id`}
          className="max-w-full text-small"
        >
          <span className="truncate font-data">{String(record.id)}</span>
        </CopyButton>
      </div>

      {resource.actions.length > 0 && (
        <RecordActions projectKey={projectKey} resource={resource} recordId={record.id} />
      )}
    </div>
  );
}

/**
 * What a human reads instead of the record. It is the definition's `labelField`
 * — validated to be a field whose value reads as a name — and it falls back to
 * the key, which is the same fallback the definition itself makes.
 */
function nameOf(resource: Resource, record: RecordDto): string {
  const value = record.values[labelFieldOf(resource)];
  if (value === null || value === undefined || typeof value === "object") return String(record.id);
  return String(value);
}

/**
 * Where the operator was before they opened this record — the table with its
 * search, filters, sort and page still on it. It rides in the router's state
 * rather than in this record's address, because those are the table's facts
 * and a link to a record should be a link to a record.
 *
 * Arriving any other way — a pasted link, a relation from another record, a
 * reload — leaves the table at its own default, which is where a first visit
 * goes anyway.
 */
function useTableAddress(projectKey: string, resourceKey: string): To {
  const { state } = useLocation();
  const from = (state as { from?: unknown } | null)?.from;

  return {
    pathname: runtimeRoutes.resource(projectKey, resourceKey),
    search: typeof from === "string" ? from : "",
  };
}

/** The record is not there, as opposed to something having gone wrong. */
function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong reading this record.";
}
