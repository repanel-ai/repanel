import type { CreateProjectRequest, ProjectDto } from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  one: (projectId: string) => [...projectKeys.all, projectId] as const,
};

/** Everything the console owns: the projects this account has created. */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => api.get<ProjectDto[]>("/projects"),
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
