import { mcpCommand, TOKEN_PLACEHOLDER } from "./setup-command";
import { Snippet } from "./snippet";

export interface McpSetupProps {
  /** Where the API answers from outside the browser — the address an agent dials. */
  apiUrl: string;
  /** The token just minted, while it is still on screen. */
  token?: string;
}

/**
 * How an agent is pointed at this project. Two forms of the same thing: the
 * command for Claude Code, and the config block for every client that is
 * configured by file rather than by command.
 *
 * While a freshly minted token is on screen the snippets carry it, because that
 * is the one moment they are useful complete. Once it is dismissed they go back
 * to naming the placeholder — there is no copy of the token left to write in.
 */
export function McpSetup({ apiUrl, token = TOKEN_PLACEHOLDER }: McpSetupProps) {
  const url = `${apiUrl}/mcp`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-body text-muted-foreground">
        Point your agent at this project. In Claude Code:
      </p>
      <Snippet what="the setup command" value={mcpCommand(apiUrl, token)} />
      <p className="text-body text-muted-foreground">Or, for a client configured by file:</p>
      <Snippet what="the setup configuration" value={configFor(url, token)} />
    </div>
  );
}

/** The same three facts — transport, address, credential — as JSON. */
function configFor(url: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        repanel: {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}
