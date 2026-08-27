import type { Pool, PoolClient, QueryResult } from "pg";

/**
 * How long a customer's database is given to answer one statement. Long enough
 * for the reads an admin makes of a table that is indexed, and short enough
 * that a runaway query is the database's problem for five seconds rather than
 * ours for an afternoon.
 */
export const STATEMENT_TIMEOUT_MS = 5_000;

/**
 * Opens the transaction the limit lives in, and sets it there. `SET LOCAL` is
 * undone when the transaction ends, so what is set here reaches this statement
 * and nothing after it — and both halves travel in one message, so the limit
 * costs one round trip rather than two.
 */
const BEGIN_BOUNDED = `begin; set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`;

/** A statement, and what to send with it. */
interface Statement {
  text: string;
  values: unknown[];
}

/**
 * Runs one statement against a customer's database under a limit the database
 * itself enforces.
 *
 * The limit is set inside the statement's own transaction rather than on the
 * connection, because the connection is not ours to keep. The databases this
 * runs against sit behind transaction-mode poolers, where a connection is a
 * different server session from one transaction to the next: a session
 * parameter asked for at connect time is refused outright there, and one set by
 * a statement of ours would be handed on to whoever the pooler lends that
 * session to next. A safety property that depends on session state is not a
 * safety property (DECISIONS #063).
 *
 * A transaction is what makes it hold, and it is the only thing this adds: one
 * statement runs inside it, and it is committed the moment that statement
 * answers.
 */
export async function runBounded(pool: Pool, statement: Statement): Promise<QueryResult> {
  const client = await pool.connect();

  try {
    await client.query(BEGIN_BOUNDED);
    const result = await client.query({ text: statement.text, values: statement.values });
    await client.query("commit");
    client.release();
    return result;
  } catch (failure) {
    await abandon(client);
    throw failure;
  }
}

/**
 * Gives the client back with nothing of this statement left on it.
 *
 * A statement that ran out of its time leaves an aborted transaction behind,
 * and a client handed back holding one refuses everything the next caller asks.
 * If the rollback cannot be sent at all, the connection is closed rather than
 * pooled: what state it is in is no longer something we know.
 */
async function abandon(client: PoolClient): Promise<void> {
  try {
    await client.query("rollback");
    client.release();
  } catch (unreachable) {
    client.release(unreachable as Error);
  }
}
