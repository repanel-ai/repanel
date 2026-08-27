import { Button, Card, FormError, Skeleton } from "@repanel/ui";
import { useState } from "react";
import { useParams } from "react-router";
import { PageHead } from "../../page-head";
import { messageOf } from "../../lib/api-client";
import { ConnectorConnection } from "./connector-connection";
import { DirectConnection } from "./direct-connection";
import {
  useConnection,
  useSaveConnection,
  useTestConnection,
  useUseConnector,
} from "./use-connection";

/**
 * How this project's database is reached, and the choice between the two ways.
 *
 * A connection string is the rung a project starts on: RePanel holds the
 * credential, and everything is one hop. A connector is the rung above it: the
 * credential never leaves the customer's network and RePanel sends descriptors
 * to a binary they run. A project is on one at a time, and choosing one takes
 * the other's credential with it — which the page says before it is done rather
 * than after.
 */
export function ConnectionPage() {
  const { id = "" } = useParams();
  const connection = useConnection(id);
  const save = useSaveConnection(id);
  const test = useTestConnection(id);
  const useConnector = useUseConnector(id);
  /**
   * The minted token, held here and nowhere else — not in the query cache, not
   * in what the API answers with afterwards. It exists for as long as this
   * screen is showing it.
   */
  const [minted, setMinted] = useState<string | null>(null);

  const current = connection.data;

  function mint() {
    useConnector.mutate(undefined, { onSuccess: ({ token }) => setMinted(token) });
  }

  return (
    <>
      <PageHead title="Connection" meta="the database this admin reads" />

      <Card className="flex min-w-0 flex-col gap-5 p-5">
        {connection.isPending && <Skeleton className="h-5 w-64" />}

        {!connection.isPending && current?.kind === "connector" && (
          <ConnectorConnection
            connection={current}
            token={minted}
            minting={useConnector.isPending}
            onMint={mint}
            onDismissToken={() => setMinted(null)}
          />
        )}

        {!connection.isPending && current?.kind !== "connector" && (
          <>
            <p className="text-body text-muted-foreground">
              {current ? (
                <>
                  Connected to{" "}
                  <span className="font-data text-foreground">
                    {current.host}/{current.database}
                  </span>
                </>
              ) : (
                "This project is not pointed at a database yet."
              )}
            </p>

            <DirectConnection
              connection={current ?? null}
              saving={save.isPending}
              saveError={messageOf(save.error)}
              onSave={(dsn) => save.mutate({ dsn })}
              testing={test.isPending}
              verdict={test.data}
              testError={messageOf(test.error)}
              onTest={() => test.mutate()}
              clearVerdict={() => test.reset()}
            />

            <div className="border-t border-border pt-4">
              <p className="text-body font-medium">Run a connector instead</p>
              <p className="mt-1 text-small text-muted-foreground">
                RePanel holds no connection string on this rung. You run one open-source binary
                beside your database; it dials out, and RePanel sends it what to read rather than
                how to read it.
              </p>
              <Button className="mt-3" variant="outline" onClick={mint} disabled={useConnector.isPending}>
                {useConnector.isPending ? "Minting…" : "Mint a connector token"}
              </Button>
              <FormError message={messageOf(useConnector.error)} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
