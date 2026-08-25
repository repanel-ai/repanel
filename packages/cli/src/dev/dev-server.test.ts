import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import net, { type AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import type { Definition, RecordDto, RecordListDto, UserDto } from "@repanel/contracts";
import { createDevServer } from "./dev-server.js";
import { WatchedDefinition } from "./project.js";
import {
  OPERATOR,
  denyEgress,
  fixtureDefinition,
  testApi,
  removeAssets,
  writeAssets,
  type TestApi,
} from "./dev.test-helpers.js";

/**
 * The whole local server, exercised the way the runtime exercises it — over
 * HTTP, on its own addresses, with the process cut off from every host but
 * this one. Nothing here mocks the engine: the reader and the runner are the
 * product's own, answering out of a definition that came off the disk.
 */

let restoreEgress: () => void;
let server: Server;
let api: TestApi;
let assets: string;
let origin: string;
let definition: Definition;

before(async () => {
  restoreEgress = denyEgress();
  assets = await writeAssets();
  definition = fixtureDefinition();
  api = testApi(() => definition);

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
  restoreEgress();
  await removeAssets(assets);
});

async function get(path: string): Promise<Response> {
  return fetch(`${origin}${path}`);
}

test("the session question is answered by the operator who started the server", async () => {
  const response = await get("/api/auth/me");

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()) as UserDto, OPERATOR);
});

test("the definition it serves is the one it was given", async () => {
  const served = (await (await get("/api/runtime/local/definition")).json()) as Definition;

  assert.equal(served.app.name, definition.app.name);
  assert.deepEqual(
    served.resources.map((resource) => resource.key),
    ["organizations", "users", "orders"],
  );
});

test("a page of records is read, filtered and searched off the query string", async () => {
  const response = await get(
    "/api/runtime/local/resources/users/records?page=2&pageSize=50&search=maya&filter[status]=active",
  );

  assert.equal(response.status, 200);
  const page = (await response.json()) as RecordListDto;
  assert.equal(page.page, 2);
  assert.equal(page.pageSize, 50);

  const sql = api.pool.texts().join("\n");
  assert.match(sql, /from "users"/);
  assert.match(sql, /"t"\."status" = \$/, "the filter reached the statement");
});

test("a date range arrives as one filter with two ends", async () => {
  api.pool.statements.length = 0;
  const response = await get(
    "/api/runtime/local/resources/users/records?filter[created_at][from]=2026-01-01&filter[created_at][to]=2026-02-01",
  );

  assert.equal(response.status, 200);
  const sql = api.pool.texts().join("\n");
  assert.match(sql, /"t"\."created_at" >= \$/);
  assert.match(sql, /"t"\."created_at" <= \$/);
});

test("a query parameter nobody recognizes is refused, not answered", async () => {
  const response = await get("/api/runtime/local/resources/users/records?pgae=2");

  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, "bad_request");
});

test("one record is read by id", async () => {
  const response = await get("/api/runtime/local/resources/users/records/u_1");

  assert.equal(response.status, 200);
  assert.ok(((await response.json()) as RecordDto).id);
});

test("a related list is a page of the target resource", async () => {
  const response = await get("/api/runtime/local/resources/users/records/u_1/related/orders");

  assert.equal(response.status, 200);
  assert.match(api.pool.texts().join("\n"), /from "orders"/);
});

test("an action the definition declares runs against the record", async () => {
  api.pool.statements.length = 0;
  const response = await fetch(`${origin}/api/runtime/local/resources/users/records/u_1/actions/suspend`, {
    method: "POST",
  });

  // 201, because the hosted route is a bare `@Post` and Nest answers those 201.
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, label: "Suspend" });
  assert.match(api.pool.texts()[0] ?? "", /^update "users" set "status" = \$/);
});

test("an api path in another case is still an api path, as it is hosted", async () => {
  const response = await get("/API/runtime/local/definition");

  // Express matches a route without regard to case, so a request that reaches
  // the hosted API must not reach the static app here.
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("a request line beginning `//` is a path, not somebody else's host", async () => {
  const response = await get("//api//runtime//local//definition");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("a parameter given twice is a contradiction, and is refused as one", async () => {
  const response = await get("/api/runtime/local/resources/users/records?page=1&page=2");

  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, "bad_request");
});

test("a refused query names every parameter that was wrong, not just the first", async () => {
  const response = await get("/api/runtime/local/resources/users/records?page=0&pageSize=999");
  const { error } = (await response.json()) as { error: { message: string } };

  assert.match(error.message, /page /);
  assert.match(error.message, /pageSize /);
});

test("a resource this admin does not have is not there, whatever the database holds", async () => {
  const response = await get("/api/runtime/local/resources/invoices/records");

  assert.equal(response.status, 404);
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, "not_found");
});

test("another project's admin is one that does not exist", async () => {
  assert.equal((await get("/api/runtime/other/definition")).status, 404);
});

test("an api path that matches no route is a miss, never the app's own html", async () => {
  const response = await get("/api/runtime/local/nonsense");

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("the root opens the admin the definition describes", async () => {
  const response = await fetch(`${origin}/`, { redirect: "manual" });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/a/local/");
});

test("every screen of the app is served the app, with the dev client attached", async () => {
  const response = await get("/a/local/r/users/u_1");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(html, /<div id="root">/);
  assert.match(html, /src="\/@repanel-dev\/overlay\.js"/);
});

test("a built asset is served as itself", async () => {
  const response = await get("/assets/index-abc.js");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/javascript/);
});

test("a missing file is a missing file, not the app", async () => {
  assert.equal((await get("/assets/gone.js")).status, 404);
});

test("a record whose id reads like a filename opens the admin, not a 404", async () => {
  // The address a browser lands on after a refresh, a shared link, or the
  // reload the overlay triggers when the definition changes.
  const response = await get("/a/local/r/users/maya.chen%40acme.com");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
});

test("nothing outside the asset directory can be read through the server", async () => {
  const response = await fetch(`${origin}/..%2f..%2fpackage.json`);

  assert.equal(response.status, 404);
});

test("the full cycle above ran with every host but this one unreachable", async () => {
  // The guard is still installed — `after` is what takes it down — so every
  // case above completed against it: nothing in the read path, the action path
  // or the asset path opened a socket off this machine. What that silence is
  // worth is established in `egress-guard.test.ts`, which is where the ways
  // this guard must fail are written down; here it is enough that it is up.
  await assert.rejects(
    fetch("http://192.0.2.1/", { signal: AbortSignal.timeout(500) }),
    /fetch failed/,
  );
  assert.throws(() => new net.Socket().connect({ host: "192.0.2.1", port: 80 }), /egress denied/);
});
