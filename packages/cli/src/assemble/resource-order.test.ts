import assert from "node:assert/strict";
import { test } from "node:test";
import { navigationOrder, orderResourceKeys } from "./resource-order.js";

test("resources are composed in navigation order, then by key", () => {
  assert.deepEqual(orderResourceKeys(["orders", "users"], ["airlines", "orders", "users", "zones"]), [
    "orders",
    "users",
    "airlines",
    "zones",
  ]);
});

test("a navigation entry with no file of its own does not reserve a place", () => {
  assert.deepEqual(orderResourceKeys(["ghost", "users"], ["users", "orders"]), ["users", "orders"]);
});

test("the navigation is read for order, first mention winning", () => {
  const app = {
    navigation: [
      { label: "Customers", resources: ["organizations", "users"] },
      { label: "Everything", resources: ["users", "orders"] },
    ],
  };
  assert.deepEqual(navigationOrder(app), ["organizations", "users", "orders"]);
});

test("a malformed navigation orders nothing rather than refusing to assemble", () => {
  assert.deepEqual(navigationOrder({ navigation: "Customers" }), []);
  assert.deepEqual(navigationOrder({ navigation: [{ resources: [7] }, null] }), []);
  assert.deepEqual(navigationOrder({}), []);
});
