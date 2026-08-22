import type { RecordId, Relationship, Resource } from "@repanel/contracts";
import { EmptyPanel, Relation, Section } from "@repanel/ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../lib/api-client";
import { relatedColumns, relatedTitle } from "./detail-layout";
import { ErrorState } from "./error-state";
import { Pagination } from "./pagination";
import { RecordTable } from "./record-table";
import { runtimeRoutes } from "./routes";
import { useRelatedRecords } from "./use-runtime";

/**
 * A nested list is read in passing, so it shows a handful and offers the rest.
 * It is fixed rather than chosen: the list has no address of its own to keep a
 * choice in, and a control that forgets is worse than no control.
 */
const RELATED_PAGE_SIZE = 5;

export interface RelatedListProps {
  projectKey: string;
  /** The resource the record on screen belongs to. */
  resource: Resource;
  recordId: RecordId;
  relationship: Relationship;
  /** The resource on the other end. Its table view is what this list draws. */
  target: Resource;
  /**
   * Whether the list has to name itself. Inside a tab it does not: the tab has
   * already named it, and saying it twice is saying it once too often.
   */
  titled?: boolean;
}

/**
 * The records one record is related to, drawn as the target resource's own
 * table at a smaller density. The columns, the order and the labels are the
 * target's — a relationship carries no display configuration, so there is
 * nothing here for a definition to have got wrong — less the one column that
 * only ever names the record already on screen (`relatedColumns`).
 */
export function RelatedList({
  projectKey,
  resource,
  recordId,
  relationship,
  target,
  titled = true,
}: RelatedListProps) {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(RELATED_PAGE_SIZE),
  }).toString();
  const records = useRelatedRecords(projectKey, resource.key, recordId, relationship.key, query);

  const columns = relatedColumns({ relationship, target });

  const total = records.data?.total ?? 0;
  const title = relatedTitle({ relationship, target });
  const count = records.data
    ? `${total.toLocaleString()} ${total === 1 ? "record" : "records"}`
    : undefined;

  const body = (
    <>
      {records.isError ? (
        <ErrorState
          title={`${title} could not be read`}
          message={
            records.error instanceof ApiError
              ? records.error.message
              : "Something went wrong reading this list."
          }
          onRetry={() => void records.refetch()}
        />
      ) : (
        <RecordTable
          projectKey={projectKey}
          resource={target}
          columns={columns}
          records={records.data?.records ?? []}
          isPending={records.isPending}
          onOpen={(id) => navigate(runtimeRoutes.record(projectKey, target.key, id))}
          density="compact"
          empty={
            <EmptyPanel
              className="py-10"
              title={`No ${target.label.plural.toLowerCase()}`}
              description={`Nothing links this ${resource.label.singular.toLowerCase()} to any ${target.label.singular.toLowerCase()}.`}
            />
          }
          footer={
            total > RELATED_PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={RELATED_PAGE_SIZE}
                total={total}
                count={records.data?.records.length ?? 0}
                onPage={setPage}
              />
            ) : undefined
          }
        />
      )}
    </>
  );

  // The heading wears the dotted rule: what is under it belongs to a different
  // record, which is the one thing this design says the same way everywhere
  // (DESIGN.md §5).
  return titled ? (
    <Section title={<Relation>{title}</Relation>} meta={count}>
      {body}
    </Section>
  ) : (
    <div className="flex min-w-0 flex-col gap-2">
      {count && <p className="text-small text-muted-foreground">{count}</p>}
      {body}
    </div>
  );
}
