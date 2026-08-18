/**
 * Who is asking. A guard resolves a request to one of these and stops there:
 * establishing identity is not the same as deciding what that identity may
 * reach, and the second decision belongs to the service that owns the data.
 */
export type Principal = UserPrincipal | AgentPrincipal;

/** A signed-in human, acting through the control plane. */
export interface UserPrincipal {
  kind: "user";
  userId: string;
}

/** A coding agent holding a project's token. That project is all it can reach. */
export interface AgentPrincipal {
  kind: "agent";
  projectId: string;
}
