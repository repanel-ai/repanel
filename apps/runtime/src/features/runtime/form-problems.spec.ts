import type { ValidationError } from "@repanel/contracts";
import { describe, expect, it } from "vitest";
import { problemsIn } from "./form-problems";

/** The fields the screen these problems are shown on actually drew. */
const DRAWN = new Set(["email", "name"]);

const problem = (path: string, message: string): ValidationError => ({
  path,
  message,
  expected: "something else",
  hint: "do something else",
});

describe("where a refusal is shown", () => {
  /**
   * Every refusal the write path raises carries `values.<field key>`, which is
   * the whole reason a form can put a sentence under the input it belongs to
   * rather than at the top of the screen (DECISIONS #056).
   */
  it("puts a problem with one value under that value's own field", () => {
    const shown = problemsIn([problem("values.email", "`nope` is not an email address.")], DRAWN);

    expect(shown.fields).toEqual({ email: "`nope` is not an email address." });
    expect(shown.form).toBeUndefined();
  });

  it("keeps each field's own problem", () => {
    const shown = problemsIn(
      [
        problem("values.email", "Required field `email` cannot be empty."),
        problem("values.name", "Required field `name` cannot be empty."),
      ],
      DRAWN,
    );

    expect(shown.fields).toEqual({
      email: "Required field `email` cannot be empty.",
      name: "Required field `name` cannot be empty.",
    });
  });

  /**
   * A refusal about the write as a whole has no input to sit under — the
   * database's own check constraints answer this way, because the constraint
   * names no column.
   */
  it("shows a problem with the write as a whole at the form", () => {
    const shown = problemsIn([problem("values", "The database refused these values.")], DRAWN);

    expect(shown.fields).toEqual({});
    expect(shown.form).toBe("The database refused these values.");
  });

  /**
   * A path this screen cannot place is still something that went wrong, and a
   * refusal shown nowhere is a form that looks like it did nothing.
   */
  it("shows a problem it cannot place at the form rather than dropping it", () => {
    const shown = problemsIn([problem("(root)", "Something else was wrong.")], DRAWN);

    expect(shown.form).toBe("Something else was wrong.");
  });

  /**
   * A refusal can name a field the definition has but this screen did not put
   * on the page — one the write rules forbid, or one an older definition left
   * open. It still has to be read somewhere.
   */
  it("shows a problem naming a field the screen did not draw at the form", () => {
    const shown = problemsIn(
      [problem("values.password_hash", "Field `password_hash` is sensitive.")],
      DRAWN,
    );

    expect(shown.fields).toEqual({});
    expect(shown.form).toBe("Field `password_hash` is sensitive.");
  });

  it("finds nothing wrong when nothing is", () => {
    expect(problemsIn([], DRAWN)).toEqual({ fields: {} });
  });
});
