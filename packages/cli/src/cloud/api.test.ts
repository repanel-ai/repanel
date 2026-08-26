import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Cloud } from "./api.js";
import { CloudError } from "./errors.js";
import { FakeCloud } from "./cloud.test-helpers.js";

const cloud = await FakeCloud.started();
after(() => cloud.close());

const TOKEN = cloud.issue("tok-1");

const CREWBASE = cloud.add({
  id: "id-crewbase",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-25T09:00:00.000Z",
});

function client(token = TOKEN): Cloud {
  return new Cloud(cloud.url, token);
}

test("every request carries the session as the cookie a browser would carry", async () => {
  await client().projects();

  const last = cloud.received.at(-1);
  assert.equal(last?.cookie, `repanel_session=${TOKEN}`);
});

test("a session RePanel does not know is an answer to `whoami`, not a failure", async () => {
  assert.equal(await client("not-a-session").whoami(), undefined);
  assert.deepEqual(await client().whoami(), {
    id: "user-ada",
    email: "ada@example.com",
    name: "Ada",
  });
});

test("an admin this account only operates is not a project it can deploy to", async () => {
  const operated = cloud.addOperated({
    id: "id-ledger",
    name: "Ledger",
    key: "ledger-d2s7u4",
    createdAt: "2026-08-25T09:00:00.000Z",
  });

  const listed = await client().projects();

  // `repanel link` and `repanel deploy` are the owner's; offering somebody
  // else's admin here would be offering a refusal one command later.
  assert.equal(listed.some((project) => project.key === operated.key), false);
  assert.ok(listed.length > 0);
});

test("a refusal anywhere else names the fix, and it is signing in again", async () => {
  const refusal = await refusalFrom(client("not-a-session").projects());

  assert.ok(refusal instanceof CloudError);
  assert.equal(refusal.status, 401);
  assert.match(refusal.hint, /repanel link/);
});

test("a connection string goes to the API and comes back as what it reaches", async () => {
  const connection = await client().connect(
    CREWBASE.id,
    "postgres://crewbase:hunter2@localhost:5433/crewbase",
  );

  assert.deepEqual(connection, { kind: "postgres", host: "localhost", database: "crewbase" });
  // The DSN left the process exactly once, to the one address it was for.
  assert.equal(cloud.connected.length, 1);
  assert.equal(cloud.connected[0]?.dsn, "postgres://crewbase:hunter2@localhost:5433/crewbase");
});

test("nothing answering at the address is a problem with a fix, not a stack", async () => {
  const nowhere = new Cloud("http://127.0.0.1:1", TOKEN);

  const refusal = await refusalFrom(nowhere.projects());

  assert.ok(refusal instanceof CloudError);
  assert.match(refusal.message, /Could not reach RePanel at http:\/\/127\.0\.0\.1:1/);
  assert.match(refusal.hint, /REPANEL_API_URL/);
  assert.equal(refusal.status, undefined);
});

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}
