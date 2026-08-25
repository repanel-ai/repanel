import type { Definition, RecordDto, UserDto, ValidationError } from "@repanel/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app";
import {
  adminDefinition,
  adminEditing,
  adminKeyedByClient,
  orderRecords,
  organizationRecord,
  organizationRecords,
  sparseUserRecord,
  userRecord,
  userRecords,
} from "./definition.fixture";
import { runtimeKeys } from "./use-runtime";

const ADA: UserDto = { id: "u_1", email: "ada@example.com", name: "Ada" };

afterEach(() => vi.unstubAllGlobals());

/**
 * Writability is declared twice and neither half is inert (DECISIONS #055), so
 * the screen has to be checked from both directions: a resource that offers
 * nothing wears no way in, and the way in is not the only wall — an address
 * typed by hand is refused too.
 */
describe("where a form is offered, and where it is not", () => {
  it("offers a new record only where the definition says one may be made", async () => {
    renderAdmin("/a/acme/r/users");

    expect(await screen.findByRole("link", { name: "New user" })).toBeDefined();
  });

  it("offers none on a resource that says nothing about writes", async () => {
    renderAdmin("/a/acme/r/organizations", { records: organizationRecords });

    await screen.findByRole("heading", { name: "Organizations" });
    expect(screen.queryByRole("link", { name: /^New/ })).toBeNull();
  });

  /**
   * `orders` offers `update` and not `create`: an order is placed by the
   * application and an operator only ever fixes a typo in one. The two flags
   * are separate decisions, and the screen reads them separately.
   */
  it("offers no new record where only corrections are offered", async () => {
    renderAdmin("/a/acme/r/orders", { records: orderRecords });

    await screen.findByRole("heading", { name: "Orders" });
    expect(screen.queryByRole("link", { name: /^New/ })).toBeNull();
  });

  it("offers an edit on a record whose resource accepts changes", async () => {
    renderAdmin("/a/acme/r/users/u_1");

    expect(await screen.findByRole("link", { name: "Edit" })).toBeDefined();
  });

  it("offers no edit on a record whose resource accepts none", async () => {
    renderAdmin("/a/acme/r/organizations/o_1", { record: organizationRecord });

    // The definition's own action, which is what says the header has been
    // drawn against a record rather than against the skeleton standing in for
    // one — the row is there, and the edit is not in it.
    expect(await screen.findByRole("button", { name: "Upgrade to Pro" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("has no such screen when a create is asked for and never offered", async () => {
    renderAdmin("/a/acme/r/organizations/new");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("This admin does not create organizations."),
    );
    expect(document.querySelector("[data-slot='form-fields']")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
  });

  it("has no such screen when a change is asked for and never offered", async () => {
    renderAdmin("/a/acme/r/organizations/o_1/edit", { record: organizationRecord });

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("This admin does not change organizations."),
    );
    expect(document.querySelector("[data-slot='form-fields']")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  /**
   * The two flags are read one at a time all the way down: a resource that
   * takes corrections is not thereby a resource records can be typed into.
   */
  it("refuses a create on a resource that only takes corrections", async () => {
    renderAdmin("/a/acme/r/orders/new");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("This admin does not create orders."),
    );
  });
});

describe("the form", () => {
  it("draws the fields the definition opened, in the order it declares them", async () => {
    renderAdmin("/a/acme/r/users/new");

    await screen.findByRole("heading", { name: "New user" });
    const labels = editableLabels();
    expect(labels).toEqual(["Email", "Name", "Organization", "Notes", "Avatar", "Trial ends", "Logins"]);
  });

  /**
   * A form that cannot draw a field cannot write it, and the fields the
   * fixture holds back are held back on purpose: `status` and `is_active` each
   * carry an action instead, and `password_hash` is a secret an admin never
   * touches at all.
   */
  it("draws no control for a field the definition kept closed", async () => {
    renderAdmin("/a/acme/r/users/new");

    await screen.findByRole("heading", { name: "New user" });
    for (const closed of ["Status", "Active", "Password hash", "Preferences", "Created", "ID"]) {
      expect(screen.queryByLabelText(closed)).toBeNull();
    }
  });

  /**
   * The key is the one control whose presence is a fact about the table rather
   * than about the field. A generated key is on no form — the insert leaves the
   * column out and the database fills it in — and a chosen one is on the form
   * that chooses it and on nothing else (DECISIONS #059).
   */
  describe("the key, where the client issues it", () => {
    const keyed = adminKeyedByClient("users");

    it("is the first control on a record being made, and must carry a value", async () => {
      renderAdmin("/a/acme/r/users/new", { definition: keyed });

      expect(await screen.findByLabelText("ID")).toHaveProperty("required", true);
      expect(editableLabels()[0]).toBe("ID");
    });

    it("is not on a record being corrected, because a key is chosen once", async () => {
      renderAdmin("/a/acme/r/users/u_1/edit", { definition: keyed });

      await screen.findByLabelText("Email");
      expect(screen.queryByLabelText("ID")).toBeNull();
    });

    it("is written with the record it names", async () => {
      const { calls } = renderAdmin("/a/acme/r/users/new", { definition: keyed });

      fireEvent.change(await screen.findByLabelText("ID"), { target: { value: "u_ada" } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
      fireEvent.click(screen.getByRole("button", { name: "Create user" }));

      await waitFor(() => expect(wrote(calls, "id")).toBe("u_ada"));
    });
  });

  it("marks the fields that must carry a value, and tells their controls so", async () => {
    renderAdmin("/a/acme/r/users/new");

    expect(await screen.findByLabelText("Email")).toHaveProperty("required", true);
    expect(screen.getByLabelText("Name")).toHaveProperty("required", true);
    expect(screen.getByLabelText("Avatar")).toHaveProperty("required", false);
    // The mark is decoration; the fact itself is on the control.
    expect(screen.getAllByText("*").every((mark) => mark.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
  });

  it("gives each type the control that type is typed into", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    expect((await screen.findByLabelText("Email")).getAttribute("type")).toBe("email");
    expect(screen.getByLabelText("Avatar").getAttribute("type")).toBe("url");
    expect(screen.getByLabelText("Trial ends").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("Logins").getAttribute("type")).toBe("number");
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
  });

  it("opens a record's form on the values the record holds", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    expect(await screen.findByLabelText("Email")).toHaveProperty(
      "value",
      "maya.okonkwo@northwind.io",
    );
    expect(screen.getByLabelText("Trial ends")).toHaveProperty("value", "2026-08-30");
    expect(screen.getByLabelText("Logins")).toHaveProperty("value", "1284");
  });

  /**
   * A relation is written as the key of another record and read as a label
   * belonging to it. v1 types the key, so the label is shown under the input —
   * wearing the mark every relation in this admin wears — for as long as the
   * key is still the one it belongs to.
   */
  it("opens a relation on the key it points at, and says what that is", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    expect(await screen.findByLabelText("Organization")).toHaveProperty("value", "o_1");
    const label = screen.getByText("Northwind Labs");
    expect(label.dataset.slot).toBe("relation");

    fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "o_2" } });
    expect(screen.queryByText("Northwind Labs")).toBeNull();
  });

  /**
   * The note is the only thing that says what a bare key points at, so a
   * control that did not carry it would be handing a screen reader a box with
   * no explanation in it.
   */
  it("points the control at what is said about its value", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    const relation = await screen.findByLabelText("Organization");
    const said = relation.getAttribute("aria-describedby");
    expect(said).not.toBeNull();
    expect(document.getElementById(said as string)?.textContent).toContain("Northwind Labs");
  });

  describe("a value that may be nothing", () => {
    /**
     * The record page says "there is nothing here" with an em-dash, and so does
     * the form: a field holding nothing is the mark, and pressing it is what
     * puts an input there. That is also the only way to tell a field that is
     * empty from one holding an empty string, which the write path treats as
     * two different values on purpose.
     */
    it("shows the em-dash until it is asked for an input", async () => {
      renderAdmin("/a/acme/r/users/u_2/edit", { record: sparseUserRecord });

      const empty = await screen.findByLabelText("Notes");
      expect(empty.tagName).toBe("BUTTON");
      expect(empty.textContent).toBe("—");

      fireEvent.click(empty);
      const input = screen.getByLabelText("Notes");
      expect(input.tagName).toBe("TEXTAREA");
      // Pressing the dash is asking to type, so it is typed into.
      expect(document.activeElement).toBe(input);
    });

    it("goes back to nothing when it is cleared, and writes nothing", async () => {
      const { calls: asked } = renderAdmin("/a/acme/r/users/u_1/edit");

      await screen.findByLabelText("Notes");
      fireEvent.click(screen.getByRole("button", { name: "Clear Notes" }));
      expect(screen.getByLabelText("Notes").tagName).toBe("BUTTON");

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(written(asked)).toEqual({ values: { notes: null } }));
    });

    /**
     * Pressing the dash is asking to type; pressing it back is asking to stop,
     * and the mark that replaces the box is where the operator now is. Focus
     * falling to the document is a keyboard losing its place on the screen.
     */
    it("keeps the keyboard where the operator left it when a value is cleared", async () => {
      renderAdmin("/a/acme/r/users/u_1/edit");

      await screen.findByLabelText("Notes");
      fireEvent.click(screen.getByRole("button", { name: "Clear Notes" }));

      expect(document.activeElement).toBe(screen.getByLabelText("Notes"));
      expect(screen.getByLabelText("Notes").tagName).toBe("BUTTON");
    });

    /**
     * A date box has no empty value, so emptying one means nothing — but the
     * box has to stay, because it is being typed into. Only pressing the dash
     * takes it away.
     */
    it("does not take the box away from somebody who has just emptied it", async () => {
      renderAdmin("/a/acme/r/users/u_1/edit");

      const day = await screen.findByLabelText("Trial ends");
      fireEvent.change(day, { target: { value: "" } });

      expect(screen.getByLabelText("Trial ends").tagName).toBe("INPUT");
    });

    it("gives a required field no way to be nothing", async () => {
      renderAdmin("/a/acme/r/users/u_1/edit");

      await screen.findByLabelText("Email");
      expect(screen.queryByRole("button", { name: "Clear Email" })).toBeNull();
    });
  });

  /**
   * The tone is the definition's, and it is ink rather than a fill: a control
   * the height of a form row wearing a badge's tint is a coloured block on a
   * data panel, which is the thing a notice stopped being (DECISIONS #052).
   */
  it("says an enum's current value in the tone the definition gave it", async () => {
    const definition = adminEditing("users", ["status"]);
    renderAdmin("/a/acme/r/users/u_1/edit", { definition });

    const status = await screen.findByLabelText("Status");
    expect(status.dataset.tone).toBe("positive");

    fireEvent.change(status, { target: { value: "suspended" } });
    expect(screen.getByLabelText("Status").dataset.tone).toBe("critical");

    // `invited` is deliberately unmapped, and an unmapped value is quiet.
    fireEvent.change(status, { target: { value: "invited" } });
    expect(screen.getByLabelText("Status").dataset.tone).toBe("neutral");
  });

  /**
   * Every moment in this admin is read in UTC (DECISIONS #030), so the digits
   * on the record's page and the digits in the box are the same digits — and
   * they are written back as such. Nothing is shifted by the offset of whatever
   * machine the form is being filled in on.
   */
  it("opens a moment on the clock the admin reads it in, and writes it back on that clock", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/u_1/edit", {
      definition: adminEditing("users", ["created_at"]),
    });

    const moment = await screen.findByLabelText("Created");
    expect(moment.getAttribute("type")).toBe("datetime-local");
    expect((moment as HTMLInputElement).value).toContain("2026-07-14T09:12");

    fireEvent.change(moment, { target: { value: "2026-07-14T11:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(wrote(asked, "created_at")).toMatch(MOMENT("11:45")));
  });

  /**
   * A boolean has two answers and a select already knows how to offer a closed
   * list of them. What goes on the wire is the value, not the word: nothing in
   * this product reads `"true"` as true (DECISIONS #055).
   */
  it("keeps a moment's seconds, which are the record's and not the form's", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/u_1/edit", {
      definition: adminEditing("users", ["created_at"]),
      record: { ...userRecord, values: { ...userRecord.values, created_at: "2026-07-14T09:12:37.000Z" } },
    });

    const moment = await screen.findByLabelText("Created");
    // `toContain`, because jsdom re-serializes a `datetime-local` value with a
    // millisecond field a browser leaves off. The digits are what is being
    // asserted, and they are the record's own.
    expect((moment as HTMLInputElement).value).toContain("2026-07-14T09:12:37");

    fireEvent.change(moment, { target: { value: "2026-07-14T11:45:37" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(wrote(asked, "created_at")).toMatch(MOMENT("11:45:37")));
  });

  it("writes a boolean as one, and not as the word for one", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/u_1/edit", {
      definition: adminEditing("users", ["is_active"]),
    });

    const active = (await screen.findByLabelText("Active")) as HTMLSelectElement;
    expect([...active.options].map((option) => option.text)).toEqual(["—", "Yes", "No"]);
    expect(active.value).toBe("true");

    fireEvent.change(active, { target: { value: "false" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(written(asked)).toEqual({ values: { is_active: false } }));
  });

  it("offers an enum only the values the definition declares", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", { definition: adminEditing("users", ["status"]) });

    const status = (await screen.findByLabelText("Status")) as HTMLSelectElement;
    expect([...status.options].map((option) => option.value)).toEqual([
      "",
      "invited",
      "active",
      "suspended",
    ]);
  });
});

describe("making a record", () => {
  it("sends only what was filled in, and lands on the record it made", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/new");

    await screen.findByRole("heading", { name: "New user" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(written(asked)).toEqual({
        values: { email: "ada@example.com", name: "Ada Lovelace" },
      }),
    );
    expect(method(asked)).toBe("POST");
    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users/u_9"));
  });

  it("says so, in the notice stack the whole app raises notices into", async () => {
    renderAdmin("/a/acme/r/users/new");

    await screen.findByRole("heading", { name: "New user" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("User created")).toBeDefined();
  });

  /**
   * The renderer runs exactly the predicate the engine runs, so a value the
   * write path would refuse is refused beside the input instead of after a
   * round trip. It is not a second opinion — the engine checks again and is
   * the one that decides.
   */
  it("refuses a required field left empty before anything is sent", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/new");

    await screen.findByRole("heading", { name: "New user" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    const problem = await screen.findByRole("alert");
    expect(problem.textContent).toContain("Required field `name` has no value.");
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBe(problem.id);
    expect(asked().some((call) => call.method !== "GET")).toBe(false);
  });

  /**
   * An empty form is refused as a write with nothing in it rather than as seven
   * empty fields, because that is what the predicate the engine runs says — and
   * the form runs that predicate rather than a second opinion of its own. The
   * message names what the resource accepts, which is the thing an operator
   * with a blank screen actually needs.
   */
  it("refuses a form nobody filled in, at the form", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/new");

    await screen.findByRole("heading", { name: "New user" });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("A write carries no values.")).toBeDefined();
    expect(asked().some((call) => call.method !== "GET")).toBe(false);
  });

  it("takes the sentence back when the value it is about changes", async () => {
    renderAdmin("/a/acme/r/users/new");

    // One field answered, so the refusal is about `name` and lands on `name` —
    // an untouched form is refused as a whole and would leave nothing here to
    // take back.
    await screen.findByRole("heading", { name: "New user" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    const problem = await screen.findByRole("alert");
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBe(problem.id);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });

    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("correcting a record", () => {
  it("sends what changed and nothing else, as a correction", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/u_1/edit");

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(written(asked)).toEqual({ values: { name: "Maya O." } }));
    expect(method(asked)).toBe("PATCH");
  });

  it("has nothing to save until something has changed", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false);
  });

  it("takes no second answer while the first one is still running", async () => {
    const { calls: asked } = renderAdmin("/a/acme/r/users/u_1/edit", { writeNeverFinishes: true });

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    const save = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(save);

    await screen.findByText("Saving…");
    expect(save).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);

    fireEvent.click(save);
    expect(asked().filter((call) => call.method === "PATCH")).toHaveLength(1);
  });

  it("goes back to the record it corrected, and says it did", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users/u_1"));
    expect(await screen.findByText("Changes saved")).toBeDefined();
  });

  /**
   * A write can be read in two places, and both are put out of date: the record
   * itself, and every page of the resource's table, which draws the fields the
   * write has just set.
   */
  it("puts the record and the table it is in out of date", async () => {
    const { calls: asked, client } = renderAdmin("/a/acme/r/users", { keepsFresh: true });

    // The whole way in, so the table's own page is in the cache to be put out
    // of date: the list, the record, and then the form.
    fireEvent.click(await screen.findByText("Maya Okonkwo"));
    fireEvent.click(await screen.findByRole("link", { name: "Edit" }));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Maya O." } });

    const readsBefore = reads(asked(), "/records/u_1");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users/u_1"));

    // The record is read again, on a cache that would otherwise never have
    // asked for it a second time.
    await waitFor(() => expect(reads(asked(), "/records/u_1")).toBeGreaterThan(readsBefore));

    // And the table is marked, though no page of it is on the screen: it is
    // read again when it is next looked at rather than now.
    const pages = client
      .getQueryCache()
      .findAll({ queryKey: runtimeKeys.resourceRecords("acme", "users") });
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every((query) => query.state.isInvalidated)).toBe(true);
  });

  it("asks before throwing away changes nobody saved", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { name: "Discard changes" })).toBeDefined();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users/u_1/edit"));
  });

  it("leaves without asking when there is nothing to throw away", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(currentUrl()).toBe("/a/acme/r/users/u_1"));
  });
});

describe("a form is only ever as wide as what may be written", () => {
  /**
   * `editable` is one of four things that decide whether a field may be
   * written, and the write path checks all four twice on purpose — a
   * definition stored before a rule existed still has to be answered. The form
   * asks the same question the engine asks, so a field the rules forbid has no
   * control here either, whatever the definition says about it.
   */
  it("draws no control for a field the rules forbid, whatever the definition says", async () => {
    renderAdmin("/a/acme/r/users/new", {
      definition: adminEditing("users", ["password_hash", "id", "preferences"]),
    });

    await screen.findByRole("heading", { name: "New user" });
    expect(screen.queryByLabelText("Password hash")).toBeNull();
    expect(screen.queryByLabelText("ID")).toBeNull();
    expect(screen.queryByLabelText("Preferences")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeDefined();
  });

  /**
   * The record's own value is what the form opens on, even where the definition
   * has since stopped listing it: a select that quietly showed a different
   * value would be misreporting the record on the one screen where it is
   * changed.
   */
  it("shows a value the definition no longer declares rather than a different one", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", {
      definition: adminEditing("users", ["status"]),
      record: { ...userRecord, values: { ...userRecord.values, status: "archived" } },
    });

    const status = (await screen.findByLabelText("Status")) as HTMLSelectElement;
    expect(status.value).toBe("archived");
    expect([...status.options].map((option) => option.value)).toContain("archived");
  });
});

describe("when the write path refuses", () => {
  /**
   * Every refusal carries a path of `values.<field key>` (DECISIONS #056),
   * which is exactly what a form needs to put the sentence under the input it
   * belongs to rather than at the top of the screen.
   */
  it("puts the refusal under the field its path names", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", {
      refuses: {
        status: 422,
        code: "write_refused",
        message: "This write was refused.",
        details: [
          {
            path: "values.email",
            message: "Another record already holds this email.",
            expected: "an email nobody else has",
            hint: "Pick another address.",
          },
        ],
      },
    });

    await screen.findByLabelText("Email");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "taken@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const problem = await screen.findByRole("alert");
    expect(problem.textContent).toBe("Another record already holds this email.");
    expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBe(problem.id);
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
  });

  /**
   * A refusal about the write as a whole has no input to sit under. The
   * database's own check constraints answer this way, because the constraint
   * names no column.
   */
  it("shows a refusal it cannot place at the form", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", {
      refuses: {
        status: 422,
        code: "write_refused",
        message: "This write was refused.",
        details: [
          {
            path: "values",
            message: "The database refused these values.",
            expected: "values the table's own constraints accept",
            hint: "A rule on this table rejected the write.",
          },
        ],
      },
    });

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("The database refused these values.")).toBeDefined();
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBeNull();
  });

  /**
   * A refusal naming a field this screen has no input for has nowhere to sit,
   * and a refusal shown nowhere is a form that looks like it did nothing.
   */
  it("shows a refusal naming a field it does not draw at the form", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", {
      refuses: {
        status: 422,
        code: "write_refused",
        message: "This write was refused.",
        details: [
          {
            path: "values.password_hash",
            message: "Field `password_hash` is sensitive and is never written from the admin.",
            expected: "one of: email, name",
            hint: "Remove `password_hash` from the write.",
          },
        ],
      },
    });

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/is sensitive and is never written/)).toBeDefined();
  });

  it("takes a refusal about the write as a whole back when a value changes", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", {
      refuses: {
        status: 422,
        code: "write_refused",
        message: "This write was refused.",
        details: [
          {
            path: "values",
            message: "The database refused these values.",
            expected: "values the table's own constraints accept",
            hint: "A rule on this table rejected the write.",
          },
        ],
      },
    });

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("The database refused these values.");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya Okonkwo Jr." } });

    expect(screen.queryByText("The database refused these values.")).toBeNull();
  });

  /**
   * The form stays on the screen when a write fails, so the account of the
   * failure stays with it. A notice would float over the button an operator is
   * about to press again, and then take the only account of it away on a clock.
   */
  it("says what went wrong at the form when the failure names no field", async () => {
    renderAdmin("/a/acme/r/users/u_1/edit", {
      refuses: { status: 504, code: "query_timeout", message: "The database took too long." },
    });

    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya O." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("The database took too long.")).toBeDefined();
    expect(currentUrl()).toBe("/a/acme/r/users/u_1/edit");
  });
});

interface Refusal {
  status: number;
  code: string;
  message: string;
  details?: ValidationError[];
}

interface AdminOptions {
  definition?: Definition;
  record?: RecordDto;
  records?: RecordDto[];
  refuses?: Refusal;
  /** A write that is sent and never answered, so the form stays in flight. */
  writeNeverFinishes?: boolean;
  /**
   * Whether what has been read stays fresh. A query that is stale refetches
   * when it is next mounted, which is a property of a default and not a fact
   * about what a write changed — so the spec that is about invalidation turns
   * it off, and everything the write puts out of date has to be put there by
   * the write.
   */
  keepsFresh?: boolean;
}

interface Call {
  url: string;
  method: string;
  body?: unknown;
}

interface Rendered {
  /** Every request the app made, in order. */
  calls: () => Call[];
  /** The cache the app read and wrote through. */
  client: QueryClient;
}

function renderAdmin(path: string, options: AdminOptions = {}): Rendered {
  const calls: Call[] = [];

  const fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    });

    if (url.endsWith("/auth/me")) return json(ADA);
    if (url.endsWith("/definition")) return json(options.definition ?? adminDefinition);

    if (method === "POST" || method === "PATCH") {
      if (options.writeNeverFinishes) return new Promise<Response>(() => {});
      if (options.refuses) {
        const { status, ...error } = options.refuses;
        return new Response(JSON.stringify({ error }), { status });
      }
      const record = options.record ?? userRecord;
      return json(method === "POST" ? { ...record, id: "u_9" } : record);
    }

    if (url.includes("/related/")) return json(page([]));
    if (url.includes("/records/")) return json(options.record ?? userRecord);
    if (url.includes("/records")) return json(page(options.records ?? userRecords));

    throw new Error(`nothing should have asked for ${url}`);
  });
  vi.stubGlobal("fetch", fetch);

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, ...(options.keepsFresh ? { staleTime: Infinity } : {}) },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <UrlProbe />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { calls: () => calls, client };
}

/** How many times something was read. */
function reads(calls: Call[], path: string): number {
  return calls.filter((call) => call.method === "GET" && call.url.endsWith(path)).length;
}

/**
 * A moment on the clock the admin reads in, with whatever precision the
 * control handed back: jsdom re-serializes a `datetime-local` value with a
 * millisecond field a browser leaves off, and both are the same moment. The
 * digits and the `Z` are what is being asserted.
 */
const MOMENT = (clock: string) => new RegExp(`^2026-07-14T${clock}(:00)?(\\.\\d+)?Z$`);

/** One value out of the write that was sent. */
function wrote(asked: () => Call[], key: string): unknown {
  return (written(asked) as { values?: Record<string, unknown> } | undefined)?.values?.[key];
}

/** The body of the one write that was sent. */
function written(asked: () => Call[]): unknown {
  return asked().find((call) => call.method === "POST" || call.method === "PATCH")?.body;
}

function method(asked: () => Call[]): string | undefined {
  return asked().find((call) => call.method === "POST" || call.method === "PATCH")?.method;
}

/** Every control the form drew, named by the label beside it. */
function editableLabels(): string[] {
  const fields = document.querySelector("[data-slot='form-fields']");
  return [...(fields?.querySelectorAll("label") ?? [])].map((label) =>
    (label.textContent ?? "").replace("*", "").trim(),
  );
}

function page(records: RecordDto[]) {
  return { records, total: records.length, page: 1, pageSize: 25 };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function currentUrl(): string {
  return screen.getByTestId("url").textContent ?? "";
}

function UrlProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="url">{`${location.pathname}${location.search}`}</span>;
}
