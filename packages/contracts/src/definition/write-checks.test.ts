import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, fieldIn, resourceIn, validFor } from "./draft.test-helpers.js";

test("the reference definition offers writes on the resources that declare them", () => {
  const definition = validFor(() => {});
  const users = definition.resources.find((resource) => resource.key === "users");
  const orders = definition.resources.find((resource) => resource.key === "orders");

  assert.deepEqual(users?.writes, { create: true, update: true });
  assert.deepEqual(orders?.writes, { create: false, update: true });
});

test("a field marked editable on a resource that offers no writes is an error, not a leftover", () => {
  const errors = errorsFor((draft) => {
    delete resourceIn(draft, "users").writes;
  });

  const error = errorAt(errors, "resources[1].fields[1].editable");
  assert.match(error.message, /marked editable but resource `users` offers no writes/);
  assert.match(error.hint, /"writes": \{ "create": true, "update": true \}/);
  assert.match(error.hint, /remove `resources\[1\].fields\[1\].editable`/);
});

test("a resource that offers writes but marks no field editable is an error", () => {
  const errors = errorsFor((draft) => {
    for (const field of resourceIn(draft, "users").fields) delete field.editable;
  });

  const error = errorAt(errors, "resources[1].writes");
  assert.match(error.message, /offers writes but has no editable field/);
  assert.match(error.hint, /a form with no fields is not a form/);
});

test("a sensitive field may not be editable, and the hint never offers unsetting sensitive", () => {
  const errors = errorsFor((draft) => {
    fieldIn(resourceIn(draft, "users"), "password_hash").editable = true;
  });

  const error = errorAt(errors, "resources[1].fields[4].editable");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be editable.");
  assert.equal(error.expected, "a field that is not marked `sensitive`");
  assert.match(error.hint, /httpCall/);
  assert.doesNotMatch(error.hint, /unset|remove `sensitive`|"sensitive": false/i);
});

test("the primary key may not be editable", () => {
  const errors = errorsFor((draft) => {
    fieldIn(resourceIn(draft, "users"), "id").editable = true;
  });

  const error = errorAt(errors, "resources[1].fields[0].editable");
  assert.match(error.message, /is the primary key of `users` and cannot be editable/);
  assert.match(error.hint, /let the database issue the key/);
});

test("a json field may not be editable", () => {
  const errors = errorsFor((draft) => {
    fieldIn(resourceIn(draft, "users"), "preferences").editable = true;
  });

  const error = errorAt(errors, "resources[1].fields[12].editable");
  assert.match(error.message, /has type `json` and cannot be editable/);
  assert.match(error.expected, /text, longText, number, boolean, date, dateTime, email, url, enum, relation/);
});

test("`required` says nothing on a field nothing writes", () => {
  const errors = errorsFor((draft) => {
    fieldIn(resourceIn(draft, "users"), "created_at").required = true;
  });

  const error = errorAt(errors, "resources[1].fields[8].required");
  assert.match(error.message, /marked required but is not editable/);
});

test("`readOnly: false` points at `writes` rather than at itself", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "organizations").readOnly = false;
  });

  const error = errorAt(errors, "resources[0].readOnly");
  assert.equal(error.message, "`readOnly: false` does not offer any write.");
  assert.match(error.hint, /Remove `resources\[0\].readOnly` and add/);
});

test("`readOnly: true` and a write are not said together", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").readOnly = true;
  });

  const error = errorAt(errors, "resources[1].readOnly");
  assert.match(error.message, /is marked `readOnly` and also offers writes/);
  assert.equal(error.expected, "either `readOnly: true` or `writes`, never both");
});

test("`readOnly: true` on a resource that offers nothing is what every v0 definition said", () => {
  const definition = validFor((draft) => {
    resourceIn(draft, "organizations").readOnly = true;
  });

  assert.equal(definition.resources[0]?.readOnly, true);
  assert.deepEqual(definition.resources[0]?.writes, { create: false, update: false });
});

/**
 * The compatibility ratchet, exercised. Every definition written against v0
 * says `readOnly: true` and knows nothing about `writes` or `editable`, and the
 * addition of forms may not cost any of them a single error (DECISIONS #012).
 */
test("a definition written before writes existed validates unchanged", () => {
  const definition = validFor((draft) => {
    for (const resource of draft.resources) {
      delete resource.writes;
      resource.readOnly = true;
      for (const field of resource.fields) {
        delete field.editable;
        delete field.required;
      }
    }
  });

  for (const resource of definition.resources) {
    assert.equal(resource.readOnly, true);
    assert.deepEqual(resource.writes, { create: false, update: false });
    assert.ok(resource.fields.every((field) => field.editable === false && field.required === false));
  }
});

test("a hidden field may be editable: hidden is detail-only, and a form is detail", () => {
  const definition = validFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "notes").hidden = true;
    users.views.table.search = ["email", "name"];
    users.views.detail.sections = users.views.detail.sections.map((section) => ({
      ...section,
      fields: section.fields,
    }));
  });

  const notes = definition.resources[1]?.fields.find((field) => field.key === "notes");
  assert.equal(notes?.hidden, true);
  assert.equal(notes?.editable, true);
});
