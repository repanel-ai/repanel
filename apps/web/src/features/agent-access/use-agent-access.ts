import type {
  ActionSecretDto,
  AgentTokenDto,
  CreateAgentTokenRequest,
  MintedAgentTokenDto,
} from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const agentAccessKeys = {
  all: ["agent-access"] as const,
  tokens: (projectId: string) => [...agentAccessKeys.all, projectId, "tokens"] as const,
  actionSecret: (projectId: string) => [...agentAccessKeys.all, projectId, "action-secret"] as const,
};

/**
 * How often the console asks again. A token's last-used stamp is written by an
 * agent in another window, exactly as a definition is, so the only way a human
 * watches an agent arrive is if the page keeps asking — and a query only polls
 * while it is mounted, which is "while someone is looking at it".
 */
const POLL_MS = 10_000;

/** What has been minted. The tokens themselves are not in here, and cannot be. */
export function useAgentTokens(projectId: string) {
  return useQuery({
    queryKey: agentAccessKeys.tokens(projectId),
    queryFn: () => api.get<AgentTokenDto[]>(`/projects/${projectId}/agent-tokens`),
    refetchInterval: POLL_MS,
  });
}

/**
 * Mints one. Its answer is the only copy of the token that will ever exist, so
 * the caller owns it from here — this hook does not put it in the cache, where
 * something else could read it back.
 */
export function useMintAgentToken(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateAgentTokenRequest) =>
      api.post<MintedAgentTokenDto>(`/projects/${projectId}/agent-tokens`, request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: agentAccessKeys.tokens(projectId) }),
  });
}

/**
 * The action-signing secret, fetched only when a human asks for it: `enabled`
 * is false, so nothing is requested until `refetch` is called. It is kept for
 * no longer than it is on screen — `gcTime: 0` drops it the moment the section
 * unmounts, so coming back to the page asks again rather than showing a secret
 * nobody asked to see twice.
 */
export function useActionSecret(projectId: string) {
  return useQuery({
    queryKey: agentAccessKeys.actionSecret(projectId),
    queryFn: () => api.get<ActionSecretDto>(`/projects/${projectId}/action-secret`),
    enabled: false,
    gcTime: 0,
    staleTime: 0,
  });
}
