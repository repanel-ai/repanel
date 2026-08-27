import type { ConnectorConnectionDto } from "@repanel/contracts";
import { Badge, Button, CopyButton, Snippet, buttonClasses } from "@repanel/ui";
import { formatMoment } from "../../lib/format-date";

/** The one line that starts a connector, with a real token or without one yet. */
export function connectCommand(token = "<token>"): string {
  return `npx @repanel/cli connect --token ${token}`;
}

export interface ConnectorConnectionProps {
  connection: ConnectorConnectionDto;
  /** The token just minted, if one was. It exists only while this is on screen. */
  token: string | null;
  minting: boolean;
  onMint: () => void;
  onDismissToken: () => void;
}

/**
 * A project served by its own connector: whether it is there, and the command
 * that starts it.
 *
 * There is no host and no database name to show, and that absence is the
 * feature rather than a gap — on this rung RePanel does not hold a connection
 * string and could not name what is behind it. What it can say is when it last
 * heard a heartbeat, so the page says exactly that.
 */
export function ConnectorConnection({
  connection,
  token,
  minting,
  onMint,
  onDismissToken,
}: ConnectorConnectionProps) {
  const command = connectCommand(token ?? undefined);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={connection.connected ? "positive" : "attention"}>
          {connection.connected ? "Connected" : "Offline"}
        </Badge>
        <p className="text-body text-muted-foreground">
          {connection.lastSeenAt
            ? `Last heard from ${formatMoment(connection.lastSeenAt)}`
            : "This project's connector has never connected."}
        </p>
      </div>

      {token && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-attention-line bg-attention-soft p-3.5">
          <p className="text-body font-medium text-attention-text">
            Copy this command now — the token in it is not shown again
          </p>
          <Snippet value={command} what="the connector command" />
          <p className="text-body text-foreground">
            RePanel stores only a digest of this token. If it is lost, mint another one.
          </p>
          <div>
            <Button variant="outline" onClick={onDismissToken}>
              I have copied it
            </Button>
          </div>
        </div>
      )}

      {!token && (
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 rounded-md border border-border bg-accent">
            <pre className="min-w-0 flex-1 overflow-x-auto px-3 py-[5px] font-mono text-small leading-5">
              {command}
            </pre>
          </div>
          <CopyButton
            value={command}
            what="the connector command"
            className={buttonClasses({
              variant: "outline",
              className: "gap-1.5 hover:text-primary-foreground",
            })}
          >
            Copy
          </CopyButton>
        </div>
      )}

      <p className="text-small text-muted-foreground">
        Run it on a machine that can reach your database. The connection string stays there;
        RePanel sends the connector what to read, never how to read it.
      </p>

      <div>
        <Button variant="outline" onClick={onMint} disabled={minting}>
          {minting ? "Minting…" : "Mint a new token"}
        </Button>
        <p className="mt-2 text-small text-muted-foreground">
          Minting a new token revokes the one before it, and disconnects any connector still using
          it.
        </p>
      </div>
    </div>
  );
}
