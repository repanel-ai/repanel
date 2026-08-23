import type { ConnectionDto, ConnectionTestDto, SetConnectionRequest } from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const connectionKeys = {
  all: ["connection"] as const,
  one: (projectId: string) => [...connectionKeys.all, projectId] as const,
};

/**
 * The database this project points at, or null. The API answers a project with
 * no connection with an empty body, which the client reads as nothing — and a
 * query may not resolve with `undefined`, so nothing becomes null here.
 */
export function useConnection(projectId: string) {
  return useQuery({
    queryKey: connectionKeys.one(projectId),
    queryFn: async () =>
      (await api.get<ConnectionDto | undefined>(`/projects/${projectId}/connection`)) ?? null,
  });
}

export function useSaveConnection(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SetConnectionRequest) =>
      api.put<ConnectionDto>(`/projects/${projectId}/connection`, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionKeys.one(projectId) }),
  });
}

/**
 * Asks the database itself. It is a mutation rather than a query because it is
 * something a human does, once, on purpose — nothing about it should happen
 * again on its own when a window regains focus.
 */
export function useTestConnection(projectId: string) {
  return useMutation({
    mutationFn: () => api.post<ConnectionTestDto>(`/projects/${projectId}/connection/test`),
  });
}
