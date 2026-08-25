import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ActionFailedError,
  DomainError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  UnservableResourceError,
} from "@repanel/engine";
import { failureOf } from "./failures.js";
import { UnreadableQueryError } from "./query-params.js";

/**
 * The status a failure gets here is the status the hosted API gives it. The
 * runtime reading these answers is the same build in both places, so a code
 * that means one thing on one and another on the other is the product being
 * two products.
 */
const EXPECTED: ReadonlyArray<[DomainError, number]> = [
  [new NotFoundError("gone"), 404],
  [new InvalidQueryError("no"), 400],
  [new QueryTimeoutError("slow"), 504],
  [new UnservableResourceError("ours"), 500],
  [new ActionFailedError("action_rejected", "refused"), 502],
  [new ActionFailedError("action_unreachable", "nothing there"), 502],
  [new ActionFailedError("action_failed", "unclear"), 502],
  [new ActionFailedError("action_timeout", "waited"), 504],
];

for (const [error, status] of EXPECTED) {
  test(`${error.name} (${error.code}) is answered ${status}`, () => {
    const failure = failureOf(error);

    assert.equal(failure.status, status);
    assert.equal(failure.body.error.code, error.code);
    assert.equal(failure.body.error.message, error.message);
  });
}

test("every error the engine publishes has a status here", () => {
  const covered = new Set(EXPECTED.map(([error]) => error.constructor.name));

  assert.deepEqual(
    [NotFoundError, InvalidQueryError, QueryTimeoutError, UnservableResourceError, ActionFailedError]
      .map((error) => error.name)
      .filter((name) => !covered.has(name)),
    [],
  );
});

test("an unreadable query is the same refusal the hosted API's pipe gives", () => {
  const failure = failureOf(new UnreadableQueryError("pgae is not a parameter"));

  assert.equal(failure.status, 400);
  assert.equal(failure.body.error.code, "bad_request");
});

test("anything else is ours, and says nothing about itself", () => {
  const failure = failureOf(new Error("connect ECONNREFUSED 127.0.0.1:5433 for user crewbase"));

  assert.equal(failure.status, 500);
  assert.equal(failure.body.error.code, "internal_error");
  assert.equal(failure.body.error.message, "Internal server error");
});

test("no failure carries details it was not given", () => {
  for (const [error] of EXPECTED) {
    assert.deepEqual(Object.keys(failureOf(error).body.error).sort(), ["code", "message"]);
  }
});
