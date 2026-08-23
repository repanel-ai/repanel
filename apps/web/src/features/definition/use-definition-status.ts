import type { DefinitionStatusDto } from "@repanel/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/**
 * How often the console asks again. The definition is written by an agent in
 * another window, so the only way a human sees it land is if the page keeps
 * asking — and a query only polls while it is mounted, which is exactly "while
 * someone is looking at it".
 */
const POLL_MS = 10_000;

/** Every cache key this feature reads comes from here. */
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
