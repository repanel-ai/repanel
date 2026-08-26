import type { AddOperatorRequest, AddedPersonDto, PersonDto } from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const peopleKeys = {
  all: ["people"] as const,
  list: (projectId: string) => [...peopleKeys.all, projectId] as const,
};

/** Who is on this project. Passwords are not on this list, and cannot be. */
export function usePeople(projectId: string) {
  return useQuery({
    queryKey: peopleKeys.list(projectId),
    queryFn: () => api.get<PersonDto[]>(`/projects/${projectId}/people`),
  });
}

/**
 * Adds an operator. Its answer may carry the one copy of a password there will
 * ever be, so the caller owns it from here — this hook does not put it in the
 * cache, where something else could read it back.
 */
export function useAddOperator(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AddOperatorRequest) =>
      api.post<AddedPersonDto>(`/projects/${projectId}/people`, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.list(projectId) }),
  });
}

/** Takes an operator off the project. Their next request is refused. */
export function useRevokePerson(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.del<void>(`/projects/${projectId}/people/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.list(projectId) }),
  });
}
