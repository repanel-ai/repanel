import type { MintedAgentTokenDto } from "@repanel/contracts";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repanel/ui";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router";
import { PageHead } from "../../page-head";
import { messageOf } from "../../lib/api-client";
import { formatDay } from "../../lib/format-date";
import { ActionSecret } from "./action-secret";
import { McpSetup } from "./mcp-setup";
import { MintedToken } from "./minted-token";
import { useAgentTokens, useMintAgentToken } from "./use-agent-access";

/**
 * Everything an agent needs to reach this project, and the one secret the
 * customer's own application needs to trust what comes back out of it.
 *
 * The minted token is held here in component state and nowhere else — not in
 * the query cache, not in the token list the API answers with. It exists for as
 * long as this screen is showing it.
 */
export function AgentAccessPage({ apiUrl }: { apiUrl: string }) {
  const { id = "" } = useParams();
  const tokens = useAgentTokens(id);
  const mint = useMintAgentToken(id);
  const [label, setLabel] = useState("");
  const [minted, setMinted] = useState<MintedAgentTokenDto | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mint.mutate(
      { label },
      {
        onSuccess: (token) => {
          setMinted(token);
          setLabel("");
        },
      },
    );
  }

  return (
    <>
      <PageHead title="Agent access" meta="what may reach this project, and what signs its actions" />

      <Card className="flex min-w-0 flex-col gap-5 p-5">
        <form className="flex flex-col gap-2" onSubmit={submit}>
          <Label htmlFor="token-label">New token</Label>
          <div className="flex flex-wrap items-start gap-2">
            <Input
              id="token-label"
              required
              placeholder="Claude Code on my laptop"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="min-w-56 flex-1"
            />
            <Button type="submit" disabled={mint.isPending || label.trim() === ""}>
              {mint.isPending ? "Minting…" : "Mint token"}
            </Button>
          </div>
          <FormError message={messageOf(mint.error)} />
        </form>

        {minted && (
          <MintedToken
            label={minted.label}
            token={minted.token}
            onDismiss={() => setMinted(null)}
          />
        )}

        {tokens.isPending && <Skeleton className="h-16 w-full" />}
        {tokens.data && tokens.data.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.data.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>{token.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDay(token.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {token.lastUsedAt ? formatDay(token.lastUsedAt) : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <McpSetup apiUrl={apiUrl} token={minted?.token} />

        <div className="border-t border-border pt-5">
          <ActionSecret projectId={id} />
        </div>
      </Card>
    </>
  );
}
