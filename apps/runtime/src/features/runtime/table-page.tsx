import type { Definition, Field, RecordId, Resource } from "@repanel/contracts";
import { Skeleton } from "@repanel/ui";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ApiError } from "../../lib/api-client";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { FilterBar } from "./filter-bar";
import { Pagination } from "./pagination";
import { RecordTable } from "./record-table";
import { runtimeRoutes } from "./routes";
import { Screen } from "./screen";
import {
  changed,
  cleared,
  isNarrowed,
  readTableState,
  toSearchParams,
  type FilterValue,
  type TableState,
} from "./table-state";
import { useRecords } from "./use-runtime";

/** The table screen: which resource it is on, what it is asking, and how that went. */
export function TablePage({ projectKey, definition }: { projectKey: string; definition: Definition }) {
  const { resourceKey = "" } = useParams();
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

  // Keyed by resource, so moving between two tables starts the next one on its
  // own first page rather than on the last one's search box.
  return <ResourceScreen key={resource.key} projectKey={projectKey} resource={resource} />;
}

function ResourceScreen({ projectKey, resource }: { projectKey: string; resource: Resource }) {
  const view = resource.views.table;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = readTableState(params, view);
  const query = toSearchParams(state, view).toString();
  const records = useRecords(projectKey, resource.key, query);

  /**
   * The only way this screen changes: write the new state to the address, and
   * read the table back out of it. Nothing here holds a copy.
   */
  const apply = (patch: Partial<TableState>, replace = false) => {
    setParams(toSearchParams(changed(state, patch), view), { replace });
  };

  const columns = view.columns
    .map((key) => resource.fields.find((field) => field.key === key))
    .filter((field): field is Field => field !== undefined);

  const total = records.data?.total ?? 0;
  const narrowed = isNarrowed(state);

  return (
    <Screen>
      <div className="flex items-baseline gap-2.5">
        <h1 className="text-title font-semibold tracking-[-0.02em]">{resource.label.plural}</h1>
        {records.data && (
          <span className="text-small text-muted-foreground">{`${total.toLocaleString()} records`}</span>
        )}
        {records.isPending && <Skeleton className="h-3 w-16" />}
      </div>

      <FilterBar
        resource={resource}
        search={state.search}
        filters={state.filters}
        isNarrowed={narrowed}
        onSearch={(term) => apply({ search: term }, true)}
        onFilter={(field, value) => apply({ filters: withFilter(state.filters, field, value) })}
        onClearAll={() => setParams(toSearchParams(cleared(state), view))}
      />

      {records.isError ? (
        <ErrorState
          title={`${resource.label.plural} could not be read`}
          message={messageOf(records.error)}
          onRetry={() => void records.refetch()}
        />
      ) : (
        <RecordTable
          projectKey={projectKey}
          resource={resource}
          columns={columns}
          records={records.data?.records ?? []}
          isPending={records.isPending}
          sort={state.sort}
          onSort={(field) => apply({ sort: nextSort(state, field) })}
          onOpen={(id: RecordId) =>
            // The record is told where its operator came from, so its way back
            // is the table they were reading rather than the table's default.
            navigate(runtimeRoutes.record(projectKey, resource.key, id), {
              state: { from: location.search },
            })
          }
          empty={
            <EmptyState
              isNarrowed={narrowed}
              plural={resource.label.plural}
              onClear={() => setParams(toSearchParams(cleared(state), view))}
            />
          }
          footer={
            total > 0 ? (
              <Pagination
                page={state.page}
                pageSize={state.pageSize}
                total={total}
                count={records.data?.records.length ?? 0}
                onPage={(page) => apply({ page })}
                onPageSize={(pageSize) => apply({ pageSize })}
              />
            ) : undefined
          }
        />
      )}

      {records.isPending && (
        <span role="status" className="sr-only">
          Loading records
        </span>
      )}
    </Screen>
  );
}

/** The same column again turns the order around; a new column starts ascending. */
function nextSort(state: TableState, field: string): TableState["sort"] {
  if (state.sort.field !== field) return { field, direction: "asc" };
  return { field, direction: state.sort.direction === "asc" ? "desc" : "asc" };
}

function withFilter(
  filters: Record<string, FilterValue>,
  field: string,
  value: FilterValue | undefined,
): Record<string, FilterValue> {
  const next = { ...filters };
  if (value === undefined) delete next[field];
  else next[field] = value;
  return next;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong reading this table.";
}
