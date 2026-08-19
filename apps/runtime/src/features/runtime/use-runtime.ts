import type { Definition, RecordListDto } from "@repanel/contracts";
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
};

export function useDefinition(projectKey: string) {
  return useQuery({
    queryKey: runtimeKeys.definition(projectKey),
    queryFn: () => api.get<Definition>(`/runtime/${encodeURIComponent(projectKey)}/definition`),
  });
}

export function useRecords(projectKey: string, resourceKey: string, query: string) {
  return useQuery({
    queryKey: runtimeKeys.records(projectKey, resourceKey, query),
    queryFn: () =>
      api.get<RecordListDto>(
        `/runtime/${encodeURIComponent(projectKey)}/resources/${encodeURIComponent(resourceKey)}/records` +
          (query === "" ? "" : `?${query}`),
      ),
  });
}
