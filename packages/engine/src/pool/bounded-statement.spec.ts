import type { Pool, QueryResult } from "pg";
import { STATEMENT_TIMEOUT_MS, runBounded } from "./bounded-statement.js";

const STATEMENT = { text: "select $1::int as n", values: [1] };

const ROWS = { rows: [{ n: 1 }], rowCount: 1 } as unknown as QueryResult;

/** What a statement came back as, so a test can decide what the database did. */
type Answer = (text: string) => QueryResult;

/**
 * Stands in for one client out of a pool. Everything sent on it is recorded,
 * because what is under test is which statements travel and in what order — a
 * limit that arrives after the statement it was meant to bound is no limit, and
 * one that arrives outside a transaction is somebody else's.
 */
class Client {
  readonly sent: Array<{ text: string; values?: unknown[] }> = [];
  returned: "pooled" | "discarded" | undefined;

  constructor(private readonly answer: Answer) {}

  query(statement: string | { text: string; values: unknown[] }): Promise<QueryResult> {
    const sent = typeof statement === "string" ? { text: statement } : statement;
    this.sent.push(sent);

    try {
      return Promise.resolve(this.answer(sent.text));
    } catch (failure) {
      return Promise.reject(failure);
    }
  }

  release(error?: Error): void {
    this.returned = error ? "discarded" : "pooled";
  }

  get texts(): string[] {
    return this.sent.map(({ text }) => text);
  }
}

function poolOf(client: Client): Pool {
  return { connect: () => Promise.resolve(client) } as unknown as Pool;
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the statement to be refused");
}

describe("runBounded", () => {
  it("sets the limit inside the statement's own transaction, before the statement", async () => {
    const client = new Client(() => ROWS);

    await runBounded(poolOf(client), STATEMENT);

    expect(client.texts).toEqual([
      `begin; set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`,
      STATEMENT.text,
      "commit",
    ]);
  });

  /**
   * The whole of the doctrine, as an assertion: nothing this sends outlives the
   * transaction it sends it in. A pooler hands the session behind this client to
   * somebody else the moment that transaction ends, so a `set` that is not a
   * `set local` is a limit applied to a stranger's queries and not to ours
   * (DECISIONS #063).
   */
  it("asks the session for nothing", async () => {
    const client = new Client(() => ROWS);

    await runBounded(poolOf(client), STATEMENT);

    const settings = client.texts.filter((text) => /\bset\b/i.test(text));
    expect(settings).not.toHaveLength(0);
    expect(settings.every((text) => /\bset local\b/i.test(text))).toBe(true);
  });

  it("sends the values with the statement, and with nothing else", async () => {
    const client = new Client(() => ROWS);

    await runBounded(poolOf(client), STATEMENT);

    expect(client.sent).toContainEqual({ text: STATEMENT.text, values: [1] });
    expect(client.sent.filter(({ values }) => values !== undefined)).toHaveLength(1);
  });

  it("answers with what the statement answered, and gives the client back", async () => {
    const client = new Client(() => ROWS);

    const result = await runBounded(poolOf(client), STATEMENT);

    expect(result).toBe(ROWS);
    expect(client.returned).toBe("pooled");
  });

  it("rolls the transaction back when the statement fails, and hands on the failure", async () => {
    const timedOut = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: "57014",
    });
    const client = new Client((text) => {
      if (text === STATEMENT.text) throw timedOut;
      return ROWS;
    });

    const refusal = await refusalFrom(runBounded(poolOf(client), STATEMENT));

    expect(refusal).toBe(timedOut);
    expect(client.texts.at(-1)).toBe("rollback");
    // An aborted transaction left on it would refuse everything the next caller
    // asks, so it goes back only once there is nothing left on it.
    expect(client.returned).toBe("pooled");
  });

  it("closes a connection it cannot even roll back", async () => {
    const client = new Client((text) => {
      if (text === "commit") throw new Error("connection terminated unexpectedly");
      if (text === "rollback") throw new Error("connection terminated unexpectedly");
      return ROWS;
    });

    await refusalFrom(runBounded(poolOf(client), STATEMENT));

    expect(client.returned).toBe("discarded");
  });
});
