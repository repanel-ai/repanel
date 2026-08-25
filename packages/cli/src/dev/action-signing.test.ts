import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { validateDefinition, type Definition, type DefinitionInput } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { createDevServer } from "./dev-server.js";
import { WatchedDefinition } from "./project.js";
import { denyEgress, removeAssets, testApi, writeAssets, type TestApi } from "./dev.test-helpers.js";

/**
 * The one write that leaves the process: an `httpCall` action, signed with the
 * secret `repanel dev` generates for the run.
 *
 * The application on the other end is the acceptance target's in miniature —
 * it reproduces docs/SIGNING.md the way `examples/crewbase` does, and refuses
 * anything it cannot verify. So this says the local server signs what it sends,
 * and that the refusal an unverified call gets is the one an operator sees.
 */

const SECRET = "the-secret-this-run-generated";

/** What the application received, so the test can read the proof it was sent. */
interface Received {
  method: string;
  url: string;
  verified: boolean;
}

let application: Server;
let received: Received[] = [];
let restoreEgress: () => void;
let server: Server;
let api: TestApi;
let assets: string;
let origin: string;

/** docs/SIGNING.md, implemented against the request as it arrived. */
function verify(secret: string, method: string, url: string, headers: Record<string, unknown>): boolean {
  const timestamp = headers["repanel-timestamp"];
  const signature = headers["repanel-signature"];
  if (typeof timestamp !== "string" || typeof signature !== "string") return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const digest = createHmac("sha256", secret).update(`${timestamp}.${method} ${url}`).digest("hex");
  const sent = Buffer.from(signature, "utf8");
  const ours = Buffer.from(`v1=${digest}`, "utf8");
  return sent.length === ours.length && timingSafeEqual(sent, ours);
}

function callingDefinition(port: number): Definition {
  const draft = structuredClone(saasDefinition) as DefinitionInput;
  const users = draft.resources.find((resource) => resource.key === "users");
  const action = users?.actions?.find((candidate) => candidate.key === "resend_invite");
  assert.ok(action && action.kind === "httpCall", "the fixture must declare an httpCall action");
  action.url = `http://127.0.0.1:${port}/repanel/users/{id}/resend-invite`;

  const result = validateDefinition(draft);
  if (!result.valid) throw new Error(`the redirected fixture no longer validates`);
  return result.definition;
}

before(async () => {
  restoreEgress = denyEgress();
  assets = await writeAssets();

  application = createServer((request, response) => {
    const url = `http://127.0.0.1:${(application.address() as AddressInfo).port}${request.url ?? ""}`;
    const verified = verify(SECRET, request.method ?? "", url, request.headers as Record<string, unknown>);
    received.push({ method: request.method ?? "", url, verified });
    response.writeHead(verified ? 200 : 401).end();
  });
  await new Promise<void>((resolve) => application.listen(0, "127.0.0.1", resolve));

  const definition = callingDefinition((application.address() as AddressInfo).port);
  api = testApi(() => definition, SECRET);
  server = createDevServer({
    api,
    watched: new WatchedDefinition(process.cwd(), definition),
    assets,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => application.close(() => resolve()));
  restoreEgress();
  await removeAssets(assets);
});

function runAction(): Promise<Response> {
  return fetch(`${origin}/api/runtime/local/resources/users/records/u_1/actions/resend_invite`, {
    method: "POST",
  });
}

test("the call the definition declares is made, and arrives signed", async () => {
  received = [];

  const response = await runAction();

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, label: "Resend invite" });
  assert.equal(received.length, 1);
  assert.equal(received[0]?.method, "POST");
  assert.equal(received[0]?.verified, true, "the application verified the signature");
});

test("the address called is the one the definition wrote, with the record filled in", async () => {
  received = [];

  await runAction();

  assert.match(received[0]?.url ?? "", /\/repanel\/users\/[^/]+\/resend-invite$/);
  assert.doesNotMatch(received[0]?.url ?? "", /\{id\}/);
});

test("an application that cannot verify the signature refuses, and the operator is told so", async () => {
  const wrong = testApi(api.definition, "not-the-secret-this-run-generated");
  const other = createDevServer({
    api: wrong,
    watched: new WatchedDefinition(process.cwd(), api.definition()),
    assets,
  });
  await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
  const port = (other.address() as AddressInfo).port;

  try {
    received = [];
    const response = await fetch(
      `http://127.0.0.1:${port}/api/runtime/local/resources/users/records/u_1/actions/resend_invite`,
      { method: "POST" },
    );

    assert.equal(received[0]?.verified, false);
    assert.equal(response.status, 502);
    const { error } = (await response.json()) as { error: { code: string; message: string } };
    assert.equal(error.code, "action_rejected");
    assert.match(error.message, /answered 401/);
  } finally {
    other.closeAllConnections();
    await new Promise<void>((resolve) => other.close(() => resolve()));
  }
});
