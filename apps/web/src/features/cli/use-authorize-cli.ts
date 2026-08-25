import type { CliSessionDto } from "@repanel/contracts";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/**
 * Mints the session the CLI on this machine will hold. A mutation because it
 * is something a human does, once, on purpose: nothing about authorizing a
 * machine should happen again on its own when a window regains focus.
 */
export function useAuthorizeCli() {
  return useMutation({ mutationFn: () => api.post<CliSessionDto>("/auth/cli") });
}
