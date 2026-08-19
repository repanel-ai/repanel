import type { UserDto } from "@repanel/contracts";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "../../lib/api-client";

/** Every cache key this feature reads comes from here. */
export const sessionKeys = {
  all: ["session"] as const,
  me: () => [...sessionKeys.all, "me"] as const,
};

/**
 * Who is signed in, or `null`. A 401 is the answer, not a failure of asking:
 * the runtime has no login screen of its own to fall back to.
 */
async function fetchMe(): Promise<UserDto | null> {
  try {
    return await api.get<UserDto>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useSession() {
  const session = useQuery({ queryKey: sessionKeys.me(), queryFn: fetchMe });

  return { user: session.data ?? null, isPending: session.isPending };
}
