import type { AgentTokenDto, ConnectionDto, DefinitionStatusDto } from "@repanel/contracts";
import { Badge, Card } from "@repanel/ui";
import type { ReactNode } from "react";
import { DefinitionBadge } from "../definition/definition-badge";
import { formatDay, formatMoment } from "../../lib/format-date";

export interface StatusCardsProps {
  connection: ConnectionDto | null;
  tokens: readonly AgentTokenDto[];
  definition: DefinitionStatusDto;
}

/**
 * The three facts a project has, at a glance: what it reads, what it renders,
 * and what may reach it. They say what *is*; the checklist under them says what
 * is left, and neither restates the other's value.
 *
 * Every line is read off a response. Nothing here is inferred, and nothing is
 * shown that the API did not say — there is no "last tested", for instance,
 * because nothing records one.
 */
export function StatusCards({ connection, tokens, definition }: StatusCardsProps) {
  const used = lastUsed(tokens);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatusCard
        label="Connection"
        value={describe(connection)}
        quiet={!connection}
        badge={connectionBadge(connection)}
        note={connectionNote(connection)}
      />

      <StatusCard
        label="Definition"
        value={definitionValue(definition)}
        quiet={definition.draft.status === "none"}
        badge={<DefinitionBadge status={definition.draft.status} />}
        note={definition.published ? "your admin is live" : "your agent writes this"}
      />

      <StatusCard
        label="Agent tokens"
        value={tokens.length === 0 ? "None yet" : `${tokens.length} active`}
        quiet={tokens.length === 0}
        badge={
          used ? (
            <Badge tone="positive">Last used {formatDay(used.lastUsedAt ?? "")}</Badge>
          ) : (
            <Badge>Never used</Badge>
          )
        }
        note={newest(tokens)?.label ?? "mint one to connect an agent"}
      />
    </div>
  );
}

interface StatusCardProps {
  label: string;
  value: string;
  /** A value that is an absence rather than a fact is set as one. */
  quiet: boolean;
  badge: ReactNode;
  note: string;
}

/**
 * One fact, on the runtime's own field pairing: a `--t-small` label over a
 * `--t-body` value (DESIGN.md §6), with the state said underneath in §4's
 * badge language.
 */
function StatusCard({ label, value, quiet, badge, note }: StatusCardProps) {
  return (
    <Card className="flex min-w-0 flex-col gap-1.5 p-4">
      <span className="text-small text-muted-foreground">{label}</span>
      <span
        className={
          quiet ? "truncate text-body text-muted-foreground" : "truncate text-body font-medium"
        }
      >
        {value}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-small text-muted-foreground">
        {badge}
        <span className="truncate">{note}</span>
      </span>
    </Card>
  );
}

function definitionValue({ draft }: DefinitionStatusDto): string {
  if (draft.status === "valid") return `Submitted ${formatMoment(draft.updatedAt)}`;
  if (draft.status === "invalid") {
    return `${draft.errorCount} ${draft.errorCount === 1 ? "problem" : "problems"}`;
  }
  return "Nothing submitted yet";
}

/** The most recently used token, or nothing if no agent has ever called. */
function lastUsed(tokens: readonly AgentTokenDto[]): AgentTokenDto | undefined {
  return tokens
    .filter((token) => token.lastUsedAt !== null)
    .sort((a, b) => String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)))[0];
}

function newest(tokens: readonly AgentTokenDto[]): AgentTokenDto | undefined {
  return [...tokens].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * What this project points at, in one line.
 *
 * A connector has no host and no database name to show, and that is the rung
 * working rather than a value missing: RePanel holds no connection string for
 * it, so it says what it does know — that a binary the customer runs is
 * answering, or is not.
 */
function describe(connection: ConnectionDto | null): string {
  if (!connection) return "No database yet";
  return connection.kind === "connector" ? "Your connector" : `${connection.host}/${connection.database}`;
}

function connectionBadge(connection: ConnectionDto | null) {
  if (!connection) return <Badge>Waiting</Badge>;
  if (connection.kind !== "connector") return <Badge tone="positive">Connected</Badge>;

  return connection.connected ? (
    <Badge tone="positive">Connected</Badge>
  ) : (
    <Badge tone="attention">Offline</Badge>
  );
}

function connectionNote(connection: ConnectionDto | null): string {
  if (!connection) return "the first step below";
  if (connection.kind !== "connector") return "encrypted, and never shown again";
  return connection.connected
    ? "beside your database, and RePanel holds no credential"
    : "start it, and this admin answers again";
}
