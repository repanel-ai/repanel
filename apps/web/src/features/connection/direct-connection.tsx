import type { ConnectionFailureReason, ConnectionTestDto, DirectConnectionDto } from "@repanel/contracts";
import { Button, FormError, Input, Label, cn } from "@repanel/ui";
import { type FormEvent, useState } from "react";

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

export interface DirectConnectionProps {
  /** What the project points at now, or nothing while it points at nothing. */
  connection: DirectConnectionDto | null;
  saving: boolean;
  saveError: string | null;
  onSave: (dsn: string) => void;
  testing: boolean;
  verdict: ConnectionTestDto | undefined;
  testError: string | null;
  onTest: () => void;
  /** Cleared when the string it was a verdict about is replaced. */
  clearVerdict: () => void;
}

/**
 * Where a human points RePanel at their database, and the only place a
 * connection string is ever typed. It is written, never read back: what comes
 * out of the API afterwards is the host and the database name, which is all
 * anyone needs to recognize what they connected.
 */
export function DirectConnection({
  connection,
  saving,
  saveError,
  onSave,
  testing,
  verdict,
  testError,
  onTest,
  clearVerdict,
}: DirectConnectionProps) {
  const [dsn, setDsn] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(dsn);
    setDsn("");
    // A verdict about the connection string that was just replaced is not a
    // verdict about anything.
    clearVerdict();
  }

  return (
    <div className="flex flex-col gap-4">
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
          <Button type="submit" disabled={saving || dsn.trim() === ""}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="text-small text-muted-foreground">
          Stored encrypted. It is never shown again, never sent to an agent, and never leaves
          RePanel.
        </p>
        <FormError message={saveError} />
      </form>

      {connection && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button variant="outline" onClick={onTest} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {verdict && (
            <p
              role="status"
              className={cn("text-body", verdict.ok ? "text-positive-text" : "text-destructive-text")}
            >
              {verdict.ok ? "The database answered." : FAILURES[verdict.reason]}
            </p>
          )}
          <FormError message={testError} />
        </div>
      )}
    </div>
  );
}
