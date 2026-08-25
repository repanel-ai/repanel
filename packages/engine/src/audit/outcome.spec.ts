import {
  ActionFailedError,
  ConflictError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  UnservableResourceError,
  ValidationFailedError,
  WriteRefusedError,
} from "../errors.js";
import { outcomeOf } from "./outcome.js";

describe("outcomeOf", () => {
  /**
   * Something decided against this, and deciding again would decide the same
   * way. The category matters because it is what an operator reading the log
   * does next: a refusal is a thing to argue with, a failure is a thing to
   * retry.
   */
  describe("what was refused", () => {
    it.each([
      ["a value the database already holds", new ConflictError("x"), "conflict"],
      ["values the definition will not accept", new ValidationFailedError("x", []), "validation_failed"],
      ["a write this resource does not offer", new WriteRefusedError("x"), "write_refused"],
      ["a record that is not there", new NotFoundError("x"), "not_found"],
      ["a question this definition cannot answer", new InvalidQueryError("x"), "invalid_query"],
      [
        "an application that said no",
        new ActionFailedError("action_rejected", "x"),
        "action_rejected",
      ],
    ])("records %s as refused", (_case, error, reason) => {
      expect(outcomeOf(error)).toEqual({ outcome: "refused", reason });
    });
  });

  describe("what went wrong", () => {
    it.each([
      ["a database out of time", new QueryTimeoutError("x"), "query_timeout"],
      ["an application out of time", new ActionFailedError("action_timeout", "x"), "action_timeout"],
      [
        "an application nothing could reach",
        new ActionFailedError("action_unreachable", "x"),
        "action_unreachable",
      ],
      ["a call that did not go through", new ActionFailedError("action_failed", "x"), "action_failed"],
      [
        "a resource this engine will not serve",
        new UnservableResourceError("x"),
        "unservable_resource",
      ],
    ])("records %s as failed", (_case, error, reason) => {
      expect(outcomeOf(error)).toEqual({ outcome: "failed", reason });
    });

    /**
     * A fault of ours reads as one, and the message never travels with it: it
     * names hosts, columns and the values that were sent.
     */
    it("records anything it has no category for as a fault of ours", () => {
      const broken = new Error("connection to db-primary.internal:5432 refused for ada@acme.test");

      expect(outcomeOf(broken)).toEqual({ outcome: "failed", reason: "internal_error" });
    });

    it("records something that was not even an error", () => {
      expect(outcomeOf("nope")).toEqual({ outcome: "failed", reason: "internal_error" });
    });
  });
});
