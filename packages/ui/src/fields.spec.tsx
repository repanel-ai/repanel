import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldRow, Fields, FormFieldRow, FormFields, type FormFieldRowProps } from "./fields";
import { Input } from "./input";

describe("Fields", () => {
  /**
   * The pairing is in the markup, not only in the columns: a screen reader
   * reads "Email, ada@example.com" without being told how the grid was laid out.
   */
  it("pairs each label with its value in a description list", () => {
    const { container } = render(
      <Fields>
        <FieldRow label="Email">ada@example.com</FieldRow>
        <FieldRow label="Name">Ada</FieldRow>
      </Fields>,
    );

    expect(container.querySelector("dl")).not.toBeNull();
    expect([...container.querySelectorAll("dt")].map((term) => term.textContent)).toEqual([
      "Email",
      "Name",
    ]);
    expect(screen.getByText("ada@example.com").tagName).toBe("DD");
  });
});

describe("FormFields", () => {
  const row = (props: Partial<FormFieldRowProps> = {}) =>
    render(
      <FormFields>
        <FormFieldRow label="Email" {...props}>
          {(control) => <Input type="email" {...control} />}
        </FormFieldRow>
      </FormFields>,
    );

  /**
   * The label is a real one and it points at the control, so clicking it
   * focuses the field and a screen reader names it — the same guarantee
   * `Fields` gives a value, on a surface where it is typed rather than read.
   */
  it("names the control its label points at", () => {
    row();

    expect(screen.getByLabelText("Email").tagName).toBe("INPUT");
  });

  /**
   * The row owns the wiring because the row is the only thing that knows the
   * message's id: a call site cannot forget to point the control at it.
   */
  it("puts the problem under the control, and points the control at it", () => {
    row({ error: "Required field `email` cannot be empty." });

    const control = screen.getByLabelText("Email");
    const problem = screen.getByRole("alert");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe(problem.id);
    expect(problem.textContent).toBe("Required field `email` cannot be empty.");
  });

  /**
   * A note is not a problem, and both are things said about the value rather
   * than names for it — so the control points at whichever of them is there,
   * and at both when both are.
   */
  it("points the control at what is said about the value, problem or not", () => {
    row({ note: "The key of the record to point at." });

    const control = screen.getByLabelText("Email");
    const said = control.getAttribute("aria-describedby") as string;
    expect(document.getElementById(said)?.textContent).toBe("The key of the record to point at.");
    expect(control.getAttribute("aria-invalid")).toBeNull();
  });

  it("points it at both when there is a note and a problem", () => {
    row({ note: "A note.", error: "A problem." });

    const said = (screen.getByLabelText("Email").getAttribute("aria-describedby") ?? "").split(" ");
    expect(said).toHaveLength(2);
    expect(said.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "A note.",
      "A problem.",
    ]);
  });

  it("says nothing about a value nothing is wrong with", () => {
    row();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBeNull();
  });

  /**
   * The mark is decoration — the fact is on the control, where assistive
   * technology already reads it. Which is also why the control is asked for by
   * its accessible name here: the mark is hidden from that name, so the field
   * is still called `Email` and not `Email *`.
   */
  it("marks a field that must carry a value, and tells the control so", () => {
    row({ required: true });

    expect(screen.getByRole("textbox", { name: "Email" }).hasAttribute("required")).toBe(true);
    expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
  });
});
