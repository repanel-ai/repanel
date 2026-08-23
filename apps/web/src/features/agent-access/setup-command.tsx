import { CopyButton, buttonClasses } from "@repanel/ui";

/** What a token looks like in the command before there is a real one to show. */
export const TOKEN_PLACEHOLDER = "<token>";

/** The one line that points an agent at this project. */
export function mcpCommand(apiUrl: string, token = TOKEN_PLACEHOLDER): string {
  return `claude mcp add --transport http repanel ${apiUrl}/mcp --header "Authorization: Bearer ${token}"`;
}

/**
 * The command, and the one thing to do with it. The other snippets on the Agent
 * access page carry a quiet glyph, because they are things to read; this one is
 * what a screen is asking for, and a screen that asks for something says so in
 * a word rather than an icon.
 */
export function SetupCommand({ apiUrl }: { apiUrl: string }) {
  const command = mcpCommand(apiUrl);

  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="flex min-w-0 flex-1 rounded-md border border-border bg-accent">
        <pre className="min-w-0 flex-1 overflow-x-auto px-3 py-[5px] font-mono text-small leading-5">
          {command}
        </pre>
      </div>
      <CopyButton
        value={command}
        what="the setup command"
        className={buttonClasses({ className: "gap-1.5 hover:text-primary-foreground" })}
      >
        Copy command
      </CopyButton>
    </div>
  );
}
