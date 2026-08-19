import { Injectable } from "@nestjs/common";
import type { ConnectionFailureReason, ConnectionTestDto } from "@repanel/contracts";
import { Client } from "pg";

/** How long the whole probe gets: connecting, asking, and answering. */
const TIMEOUT_MS = 5_000;

/**
 * The driver's own limit, set later than ours on purpose. Ours decides the
 * answer; this one only gives a stalled socket back afterwards. Were it first,
 * the probe would have to read a timeout out of a driver's wording.
 */
const SOCKET_TIMEOUT_MS = TIMEOUT_MS + 1_000;

/** Ours, so a timeout is something we decided rather than something we parsed. */
class ProbeTimedOut extends Error {}

/** What Postgres refuses a bad credential with. */
const AUTH_FAILURES = new Set(["28P01", "28000"]);

/** What a socket says when nothing is listening, or nothing is there at all. */
const UNREACHABLE = new Set(["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"]);

/**
 * Whether a DSN reaches a working database. The answer is a category and never
 * the driver's words: those name hosts and users, and for some failures repeat
 * the credential back. One client, used once and closed — a DSN being tested is
 * not one to keep a pool on.
 */
@Injectable()
export class ConnectionProbeService {
  async check(dsn: string): Promise<ConnectionTestDto> {
    const client = new Client({
      connectionString: dsn,
      connectionTimeoutMillis: SOCKET_TIMEOUT_MS,
    });
    // A socket that dies with no query in flight is announced on the client
    // itself, and an emitter with no listener for `error` throws where nothing
    // can catch it — taking the API down with the customer's database. The
    // failure is already answered by the race below; this only defuses it.
    client.on("error", () => undefined);
    let deadline: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        answer(client),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new ProbeTimedOut()), TIMEOUT_MS);
        }),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: reasonFor(error) };
    } finally {
      clearTimeout(deadline);
      // Closing is started, not waited for: a client caught mid-connect only
      // lets go once the driver's own limit above fires, and the answer this
      // probe promised in five seconds is not waiting around for that.
      void client.end().catch(() => undefined);
    }
  }
}

/** The question itself: reach the database, and ask the cheapest thing there is. */
async function answer(client: Client): Promise<void> {
  await client.connect();
  await client.query("select 1");
}

/** Which of the four categories a failure falls into. Codes only, never prose. */
function reasonFor(error: unknown): ConnectionFailureReason {
  if (error instanceof ProbeTimedOut) return "timeout";

  // Read for the code it carries rather than asked what it is: a failure from
  // a socket is not made here, and need not be one of our own kind of Error.
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code !== "string") return "unknown";
  if (AUTH_FAILURES.has(code)) return "auth_failed";
  if (UNREACHABLE.has(code)) return "unreachable";
  if (code === "ETIMEDOUT") return "timeout";
  return "unknown";
}
