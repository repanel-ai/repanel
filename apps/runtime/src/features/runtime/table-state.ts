import { DEFAULT_PAGE_SIZE, type DateRangeFilter, type TableView } from "@repanel/contracts";

/**
 * What a table is currently asking for, and the address that asks it.
 *
 * The URL is the state: everything here is read from the query string and
 * written back to it, so a table an operator narrowed down is a link they can
 * send. The parameter names are the API's own — `page`, `search`,
 * `filter[status]` — so the address in the browser and the request behind it
 * are the same sentence, and there is no second vocabulary to keep in step.
 */

/** What the page-size selector offers. Anything else is not a size we render. */
export const PAGE_SIZES = [25, 50, 100] as const;

export type FilterValue = string | DateRangeFilter;

export interface TableSort {
  field: string;
  direction: "asc" | "desc";
}

export interface TableState {
  page: number;
  pageSize: number;
  /** The free-text term, or "" — an empty box is not a search. */
  search: string;
  /** Always resolved: the address's sort, or the definition's own. */
  sort: TableSort;
  filters: Record<string, FilterValue>;
}

/** `filter[status]`, or `filter[created_at][from]`. */
const FILTER_PARAM = /^filter\[([^\]]+)\](?:\[(from|to)\])?$/;

export function readTableState(params: URLSearchParams, view: TableView): TableState {
  return {
    page: readPage(params.get("page")),
    pageSize: readPageSize(params.get("pageSize")),
    search: params.get("search")?.trim() ?? "",
    sort: readSort(params, view),
    filters: readFilters(params, view),
  };
}

/**
 * The address for a state, carrying only what a default does not already say —
 * an untouched table has an empty query string, and the same params are what
 * the records request is made of.
 */
export function toSearchParams(state: TableState, view: TableView): URLSearchParams {
  const params = new URLSearchParams();

  if (state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(state.pageSize));
  if (state.search !== "") params.set("search", state.search);

  const { defaultSort } = view;
  if (state.sort.field !== defaultSort.field || state.sort.direction !== defaultSort.direction) {
    params.set("sort", state.sort.field);
    params.set("direction", state.sort.direction);
  }

  // In the order the view declares them, so the same state is always the same
  // address — and the same cache key.
  for (const filter of view.filters) {
    const value = state.filters[filter.field];
    if (value === undefined) continue;
    if (typeof value === "string") {
      if (value !== "") params.set(`filter[${filter.field}]`, value);
      continue;
    }
    if (value.from) params.set(`filter[${filter.field}][from]`, value.from);
    if (value.to) params.set(`filter[${filter.field}][to]`, value.to);
  }

  return params;
}

/**
 * The state after something changed. Every change but a page change returns to
 * the first page: page 7 of one question is not page 7 of the next, and a table
 * that answers a new filter with an empty page 7 has lied about being empty.
 */
export function changed(state: TableState, patch: Partial<TableState>): TableState {
  return { ...state, ...patch, page: patch.page ?? 1 };
}

/** Everything that narrows the table, dropped. How it is read is kept. */
export function cleared(state: TableState): TableState {
  return { ...state, search: "", filters: {}, page: 1 };
}

/** Whether anything is standing between the operator and the whole table. */
export function isNarrowed(state: TableState): boolean {
  return state.search !== "" || Object.keys(state.filters).length > 0;
}

function readPage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function readPageSize(raw: string | null): number {
  const size = Number(raw);
  return PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number]) ? size : DEFAULT_PAGE_SIZE;
}

/**
 * A sort the table can show. Only a column can be sorted from here, so the
 * arrow in a header and the order of the rows under it are the same fact; an
 * address naming anything else falls back to the definition's own sort.
 */
function readSort(params: URLSearchParams, view: TableView): TableSort {
  const field = params.get("sort");
  const direction = params.get("direction") === "desc" ? "desc" : "asc";

  if (field && view.columns.includes(field)) return { field, direction };
  return { ...view.defaultSort };
}

function readFilters(params: URLSearchParams, view: TableView): Record<string, FilterValue> {
  const declared = new Map(view.filters.map((filter) => [filter.field, filter.kind]));
  const filters: Record<string, FilterValue> = {};

  for (const [key, value] of params) {
    const match = FILTER_PARAM.exec(key);
    if (!match) continue;

    const [, field, end] = match;
    const kind = declared.get(field ?? "");
    // A filter this resource does not declare is refused by the API, so a link
    // carried over from another resource opens on the whole table instead.
    if (!field || !kind || value === "") continue;

    if (kind === "dateRange") {
      if (!end) continue;
      const range = (filters[field] as DateRangeFilter | undefined) ?? {};
      filters[field] = { ...range, [end]: value };
      continue;
    }

    if (!end) filters[field] = value;
  }

  return filters;
}
