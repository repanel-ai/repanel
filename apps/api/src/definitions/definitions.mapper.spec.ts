import type { ValidationError } from "@repanel/contracts";
import { toDefinitionDraft, toStoredValidation } from "./definitions.mapper";
import type { DefinitionRow } from "./definitions.repository";

const MISSING_NAVIGATION: ValidationError = {
  path: "navigation",
  message: "Required key `navigation` is missing.",
  expected: "an array of navigation groups",
  hint: "Add `navigation: [{ label: \"Data\", resources: [\"orders\"] }]`.",
};

const ROW: DefinitionRow = {
  id: "2f1c9e64-5a1b-4d3e-8f77-6c2a9b0d1e33",
  projectId: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  payload: { schemaVersion: "0.1", app: { name: "Acme Admin" } },
  valid: false,
  errors: [MISSING_NAVIGATION],
  createdAt: new Date("2026-08-18T12:00:00.000Z"),
  updatedAt: new Date("2026-08-19T09:30:00.000Z"),
};

const VALID_ROW: DefinitionRow = { ...ROW, valid: true, errors: null };

describe("toDefinitionDraft", () => {
  it("renders the row as the shape the feature hands out", () => {
    expect(toDefinitionDraft(ROW)).toEqual({
      payload: ROW.payload,
      valid: false,
      errors: [MISSING_NAVIGATION],
      updatedAt: "2026-08-19T09:30:00.000Z",
    });
  });

  it("leaves the row's own identifiers behind", () => {
    expect(Object.keys(toDefinitionDraft(ROW))).not.toContain("id");
    expect(Object.keys(toDefinitionDraft(ROW))).not.toContain("projectId");
  });

  it("carries an invalid payload out as it was submitted", () => {
    // The agent reads back what it sent; a draft it cannot see it cannot fix.
    expect(toDefinitionDraft(ROW).payload).toEqual(ROW.payload);
  });

  it("reports a valid draft as having nothing to report", () => {
    expect(toDefinitionDraft(VALID_ROW).errors).toBeNull();
  });
});

describe("toStoredValidation", () => {
  it("answers with the verdict alone", () => {
    expect(toStoredValidation(ROW)).toEqual({
      valid: false,
      errors: [MISSING_NAVIGATION],
      updatedAt: "2026-08-19T09:30:00.000Z",
    });
  });

  it("says when the verdict was reached, so a caller need not read the draft for it", () => {
    expect(toStoredValidation(ROW).updatedAt).toBe("2026-08-19T09:30:00.000Z");
  });

  it("does not carry the payload along", () => {
    expect(Object.keys(toStoredValidation(ROW))).not.toContain("payload");
  });

  it("reads a valid draft's empty errors column as nothing to report", () => {
    expect(toStoredValidation(VALID_ROW)).toEqual({
      valid: true,
      errors: null,
      updatedAt: "2026-08-19T09:30:00.000Z",
    });
  });
});
