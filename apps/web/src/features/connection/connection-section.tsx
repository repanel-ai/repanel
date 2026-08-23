import type { ConnectionFailureReason } from "@repanel/contracts";
import { Button, Card, FormError, Input, Label, Section, Skeleton, cn } from "@repanel/ui";
import { type FormEvent, useState } from "react";
import { messageOf } from "../../lib/api-client";
import { useConnection, useSaveConnection, useTestConnection } from "./use-connection";

/**
 * The four categories a failed probe comes back as (007), each said in a
 * sentence someone can act on. The driver's own words never reach here — they
 * name hosts and users and sometimes repeat the credential — so this is the
 * whole vocabulary of failure the console has, and it is deliberately short.
 */
const FAILURES: Record<ConnectionFailureReason, string> = {
  unreachable: "Nothing answered at that host and port.",
  auth_failed: "The database refused those credentials.",
  timeout: "The database did not answer in time.",
  unknown: "The connection failed, for a reason RePanel could not identify.",
};

/**
 * Where a human points RePanel at their database, and the only place the
 * connection string is ever typed. It is written, never read back: what comes
 * out of the API afterwards is the host and the database name, which is all
 * anyone needs to recognize what they connected.
 */
export function ConnectionSection({ projectId }: { projectId: string }) {
  const connection = useConnection(projectId);
  const save = useSaveConnection(projectId);
  const test = useTestConnection(projectId);
  const [dsn, setDsn] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(
      { dsn },
      {
        onSuccess: () => {
          setDsn("");
          // A verdict about the connection string that was just replaced is
          // not a verdict about anything.
          test.reset();
        },
      },
    );
  }

  return (
    <Section title="Connection">
      <Card className="flex flex-col gap-4">
        {connection.isPending ? (
          <Skeleton className="h-5 w-64" />
        ) : (
          <p className="text-body text-muted-foreground">
            {connection.data ? (
              <>
                Connected to{" "}
                <span className="font-data text-foreground">
                  {connection.data.host}/{connection.data.database}
                </span>
              </>
            ) : (
              "This project is not pointed at a database yet."
            )}
          </p>
        )}

        <form className="flex flex-col gap-2" onSubmit={submit}>
          <Label htmlFor="dsn">Connection string</Label>
          <div className="flex flex-wrap items-start gap-2">
            <Input
              id="dsn"
              type="password"
              autoComplete="off"
              required
              placeholder="postgres://user:password@host:5432/database"
              value={dsn}
              onChange={(event) => setDsn(event.target.value)}
              className="min-w-64 flex-1"
            />
            <Button type="submit" disabled={save.isPending || dsn.trim() === ""}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="text-small text-muted-foreground">
            Stored encrypted. It is never shown again, never sent to an agent, and never
            leaves RePanel.
          </p>
          <FormError message={messageOf(save.error)} />
        </form>

        {connection.data && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? "Testing…" : "Test connection"}
            </Button>
            {test.data && (
              <p
                role="status"
                className={cn(
                  "text-body",
                  test.data.ok ? "text-positive-text" : "text-destructive-text",
                )}
              >
                {test.data.ok ? "The database answered." : FAILURES[test.data.reason]}
              </p>
            )}
            <FormError message={messageOf(test.error)} />
          </div>
        )}
      </Card>
    </Section>
  );
}
