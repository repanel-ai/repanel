import assert from "node:assert/strict";
import { after, test } from "node:test";
import { OVERLAY_PATH, hasRuntime, isAppRoute, readAsset, withOverlay } from "./spa.js";
import { removeAssets, writeAssets } from "./dev.test-helpers.js";

/** One app on disk for every case here; each of them only reads it. */
const root = await writeAssets();
after(() => removeAssets(root));

test("a file the app contains is read, with the type it is", async () => {
  const asset = await readAsset(root, "/assets/index-abc.js");

  assert.match(asset?.contentType ?? "", /text\/javascript/);
  assert.match(String(asset?.body), /export default 1/);
});

test("a file the app does not contain is nothing", async () => {
  assert.equal(await readAsset(root, "/assets/gone.js"), undefined);
});

test("a type this server cannot name is not served, whatever is on disk", async () => {
  assert.equal(await readAsset(root, "/secrets.pem"), undefined);
});

test("a path that climbs out of the app is answered as a miss", async () => {
  assert.equal(await readAsset(root, "/../../package.json"), undefined);
  assert.equal(await readAsset(root, "/assets/../../package.json"), undefined);
});

test("the dev client is attached to the document, not built into the bundle", () => {
  const html = withOverlay("<!doctype html><html><body><div id=\"root\"></div></body></html>");

  assert.match(html, new RegExp(`src="${OVERLAY_PATH}"`));
  assert.ok(html.indexOf(OVERLAY_PATH) < html.indexOf("</body>"), "it is inside the document");
});

test("a document with no closing body still gets the client", () => {
  assert.match(withOverlay("<div id=\"root\"></div>"), new RegExp(OVERLAY_PATH));
});

test("a screen is an address in the app's route space, whatever it looks like", () => {
  assert.equal(isAppRoute("/a/local/r/users/u_1"), true);
  assert.equal(isAppRoute("/a/local/"), true);
  assert.equal(isAppRoute("/assets/index-abc.js"), false);
  assert.equal(isAppRoute("/nothing/here"), false);
});

test("a record whose id reads like a filename is still a record", () => {
  // A primary key is often an email or a dotted id, and `.com` is not a file
  // type. Guessing from the last segment 404s a real record's own address.
  assert.equal(isAppRoute("/a/local/r/users/maya.chen%40acme.com"), true);
  assert.equal(isAppRoute("/a/local/r/packages/com.acme.app"), true);
  assert.equal(isAppRoute("/a/local/r/releases/v1.2"), true);
});

test("a package carrying no app says so before anything opens a port", async () => {
  assert.equal(await hasRuntime(root), true);
  assert.equal(await hasRuntime("/nowhere/at/all"), false);
});
