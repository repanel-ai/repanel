/**
 * Who is asking. A guard resolves a request to one of these and stops there:
 * establishing identity is not the same as deciding what that identity may
 * reach, and the second decision belongs to the service that owns the data.
 */
export type Principal = UserPrincipal | AgentPrincipal | ConnectorPrincipal;

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

/**
 * A project's connector, holding the token that project minted for it. Like an
 * agent token it names exactly one project and that project is all it can
 * reach — and like an agent token it holds no role, because what it may do is
 * fixed by there being nothing else to ask for.
 */
export interface ConnectorPrincipal {
  kind: "connector";
  projectId: string;
}
