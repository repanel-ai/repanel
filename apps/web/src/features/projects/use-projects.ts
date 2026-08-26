import type { CreateProjectRequest, ProjectDto, ProjectMembershipDto } from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  one: (projectId: string) => [...projectKeys.all, projectId] as const,
};

/**
 * Everywhere this account may go, and what it may do there. Projects it owns
 * and admins it merely operates come back on one list, because "where may I
 * go" is one question and the console is what answers it after signing in.
 */
export function useMemberships() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => api.get<ProjectMembershipDto[]>("/projects"),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.one(projectId),
    queryFn: () => api.get<ProjectDto>(`/projects/${projectId}`),
  });
}

/**
 * Creates a project. The list is put out of date rather than written into:
 * the key is minted server-side, so what the list should now hold is the
 * server's answer and not ours.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateProjectRequest) => api.post<ProjectDto>("/projects", request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}
