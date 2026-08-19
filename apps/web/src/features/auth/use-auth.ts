import type { LoginRequest, UserDto } from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../../lib/api-client";

/** Every cache key this feature reads or invalidates comes from here. */
export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/**
 * The signed-in user, or `null`. A 401 is the answer to "who is signed in?",
 * not a failure of asking — treating it as an error would put the whole app in
 * an error state for the ordinary case of being signed out.
 */
async function fetchMe(): Promise<UserDto | null> {
  try {
    return await api.get<UserDto>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe });

  // Both mutations answer with the session cookie the browser now holds, so
  // the only honest next step is to ask the API who that is.
  const forgetSession = () => queryClient.invalidateQueries({ queryKey: authKeys.me() });

  const login = useMutation({
    mutationFn: (credentials: LoginRequest) => api.post<UserDto>("/auth/login", credentials),
    onSuccess: forgetSession,
  });

  const logout = useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSuccess: forgetSession,
  });

  return { user: session.data ?? null, isPending: session.isPending, login, logout };
}
