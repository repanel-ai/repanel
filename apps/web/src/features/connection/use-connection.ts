import type {
  ConnectionDto,
  ConnectionTestDto,
  MintedConnectorTokenDto,
  SetConnectionRequest,
} from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const connectionKeys = {
  all: ["connection"] as const,
  one: (projectId: string) => [...connectionKeys.all, projectId] as const,
};

/**
 * How often the page asks again whether a connector is there.
 *
 * A connector heartbeats every fifteen seconds, so asking on that cadence is
 * the fastest this can honestly be. It is polling rather than a channel of its
 * own: the console has no socket, and opening one to watch a status light would
 * be the only one in the product.
 */
const PRESENCE_INTERVAL_MS = 15_000;

/**
 * The database this project points at, or null. The API answers a project with
 * no connection with an empty body, which the client reads as nothing — and a
 * query may not resolve with `undefined`, so nothing becomes null here.
 *
 * It refetches while the page is open, because half of what it answers is a
 * connector's liveness and that is a fact with a shelf life.
 */
export function useConnection(projectId: string) {
  return useQuery({
    queryKey: connectionKeys.one(projectId),
    queryFn: async () =>
      (await api.get<ConnectionDto | undefined>(`/projects/${projectId}/connection`)) ?? null,
    refetchInterval: PRESENCE_INTERVAL_MS,
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
 * Puts this project on the connector rung and mints the token its connector
 * dials with. Minting again replaces the token, which is what revokes the one
 * before it — so this is something a human does on purpose, never something a
 * refocused window does again on its own.
 */
export function useUseConnector(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<MintedConnectorTokenDto>(`/projects/${projectId}/connection/connector`),
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
