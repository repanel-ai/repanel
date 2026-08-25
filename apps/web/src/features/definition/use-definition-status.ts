import type { DefinitionStatusDto, PublishedDefinitionDto } from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/**
 * How often the console asks again. The definition is written by an agent in
 * another window, so the only way a human sees it land is if the page keeps
 * asking — and a query only polls while it is mounted, which is exactly "while
 * someone is looking at it".
 */
const POLL_MS = 10_000;

/** Every cache key this feature reads or invalidates comes from here. */
export const definitionKeys = {
  all: ["definition"] as const,
  status: (projectId: string) => [...definitionKeys.all, projectId, "status"] as const,
};

export function useDefinitionStatus(projectId: string) {
  return useQuery({
    queryKey: definitionKeys.status(projectId),
    queryFn: () => api.get<DefinitionStatusDto>(`/projects/${projectId}/definition/status`),
    refetchInterval: POLL_MS,
  });
}

/**
 * Makes the draft the version operators are served. A mutation because it is
 * something a human does once, on purpose: nothing about publishing should
 * happen again on its own when a window regains focus.
 */
export function usePublishDefinition(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<PublishedDefinitionDto>(`/projects/${projectId}/definition/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: definitionKeys.status(projectId) }),
  });
}
