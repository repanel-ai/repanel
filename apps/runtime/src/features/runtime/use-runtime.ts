import type { Definition, RecordDto, RecordId, RecordListDto } from "@repanel/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/**
 * Everything the rendered admin reads: the definition it draws itself from, and
 * the pages of records it draws. Both come from the project's own routes, and
 * nothing in this app fetches anything anywhere else.
 */

/** Every cache key this feature reads comes from here. */
export const runtimeKeys = {
  all: ["runtime"] as const,
  project: (projectKey: string) => [...runtimeKeys.all, projectKey] as const,
  definition: (projectKey: string) => [...runtimeKeys.project(projectKey), "definition"] as const,
  /**
   * `query` is the serialized table state — the same string the address bar
   * carries and the request is made of, so two questions share a cache entry
   * exactly when they are the same question.
   */
  records: (projectKey: string, resourceKey: string, query: string) =>
    [...runtimeKeys.project(projectKey), "records", resourceKey, query] as const,
  record: (projectKey: string, resourceKey: string, id: RecordId) =>
    [...runtimeKeys.project(projectKey), "record", resourceKey, String(id)] as const,
  /**
   * Filed under the record it belongs to, so putting one record out of date
   * puts the lists hanging off it out of date with it.
   */
  related: (projectKey: string, resourceKey: string, id: RecordId, relationshipKey: string, query: string) =>
    [...runtimeKeys.record(projectKey, resourceKey, id), "related", relationshipKey, query] as const,
};

/** Every value in these paths came out of a definition or an address bar. */
function resourcePath(projectKey: string, resourceKey: string): string {
  return `/runtime/${encodeURIComponent(projectKey)}/resources/${encodeURIComponent(resourceKey)}`;
}

function recordPath(projectKey: string, resourceKey: string, id: RecordId): string {
  return `${resourcePath(projectKey, resourceKey)}/records/${encodeURIComponent(String(id))}`;
}

function asked(path: string, query: string): string {
  return query === "" ? path : `${path}?${query}`;
}

export function useDefinition(projectKey: string) {
  return useQuery({
    queryKey: runtimeKeys.definition(projectKey),
    queryFn: () => api.get<Definition>(`/runtime/${encodeURIComponent(projectKey)}/definition`),
  });
}

export function useRecords(projectKey: string, resourceKey: string, query: string) {
  return useQuery({
    queryKey: runtimeKeys.records(projectKey, resourceKey, query),
    queryFn: () => api.get<RecordListDto>(asked(`${resourcePath(projectKey, resourceKey)}/records`, query)),
  });
}

/** One record, in full: hidden fields included, sensitive ones never sent. */
export function useRecord(projectKey: string, resourceKey: string, id: RecordId) {
  return useQuery({
    queryKey: runtimeKeys.record(projectKey, resourceKey, id),
    queryFn: () => api.get<RecordDto>(recordPath(projectKey, resourceKey, id)),
  });
}

/**
 * A page of the records one record is related to. Whichever way the
 * relationship points, the page is the target resource's own list narrowed to
 * this record — the API decides that; this only asks.
 */
export function useRelatedRecords(
  projectKey: string,
  resourceKey: string,
  id: RecordId,
  relationshipKey: string,
  query: string,
) {
  return useQuery({
    queryKey: runtimeKeys.related(projectKey, resourceKey, id, relationshipKey, query),
    queryFn: () =>
      api.get<RecordListDto>(
        asked(
          `${recordPath(projectKey, resourceKey, id)}/related/${encodeURIComponent(relationshipKey)}`,
          query,
        ),
      ),
  });
}
