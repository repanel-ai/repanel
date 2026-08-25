import assert from "node:assert/strict";
import { test } from "node:test";
import { addressesFrom } from "./addresses.js";

test("a checkout with nothing set is pointed at the development deployment", () => {
  assert.deepEqual(addressesFrom({}), {
    api: "http://localhost:3001",
    console: "http://localhost:5173",
  });
});

test("a deployment states where its surfaces are, and each is read separately", () => {
  const addresses = addressesFrom({
    REPANEL_API_URL: "https://api.example.test",
    REPANEL_CONSOLE_URL: "https://console.example.test",
  });

  assert.equal(addresses.api, "https://api.example.test");
  assert.equal(addresses.console, "https://console.example.test");
});

test("a trailing slash is dropped once, here, because addresses are built onto these", () => {
  const addresses = addressesFrom({
    REPANEL_API_URL: "https://api.example.test//",
    REPANEL_CONSOLE_URL: "https://console.example.test/",
  });

  assert.equal(addresses.api, "https://api.example.test");
  assert.equal(addresses.console, "https://console.example.test");
});

test("a variable set to nothing is not an address", () => {
  assert.equal(addressesFrom({ REPANEL_API_URL: "  " }).api, "http://localhost:3001");
});
