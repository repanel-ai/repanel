import type { ValidationError } from "@repanel/contracts";
import type { DefinitionVersionRow } from "./definition-versions.repository";
import {
  toDefinitionDraft,
  toDefinitionStatus,
  toPublishedDefinition,
  toStoredValidation,
} from "./definitions.mapper";
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

const VERSION_ROW: DefinitionVersionRow = {
  id: "b1d0a4f2-77b1-4f0e-9a4a-2c6c7d8e9f00",
  projectId: ROW.projectId,
  version: 3,
  payload: { schemaVersion: "0.1", app: { name: "Acme Admin" } },
  publishedAt: new Date("2026-08-19T09:00:00.000Z"),
};

/** The version that is live, as the feature passes it around. */
const PUBLISHED = toPublishedDefinition(VERSION_ROW);

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

describe("toPublishedDefinition", () => {
  it("renders the row as the shape the feature hands out", () => {
    expect(toPublishedDefinition(VERSION_ROW)).toEqual({
      version: 3,
      publishedAt: "2026-08-19T09:00:00.000Z",
      payload: VERSION_ROW.payload,
    });
  });

  it("leaves the row's own identifiers behind", () => {
    expect(Object.keys(toPublishedDefinition(VERSION_ROW))).not.toContain("id");
    expect(Object.keys(toPublishedDefinition(VERSION_ROW))).not.toContain("projectId");
  });
});

describe("toDefinitionStatus", () => {
  it("says nothing has been submitted and nothing is live when nothing is", () => {
    expect(toDefinitionStatus(null, null)).toEqual({
      draft: { status: "none" },
      published: null,
      unpublishedChanges: false,
    });
  });

  it("hands an invalid draft's problems on in full, and counts them", () => {
    expect(toDefinitionStatus(toStoredValidation(ROW), null).draft).toEqual({
      status: "invalid",
      errorCount: 1,
      errors: [MISSING_NAVIGATION],
    });
  });

  it("says when a valid draft was submitted, and nothing else", () => {
    expect(toDefinitionStatus(toStoredValidation(VALID_ROW), null).draft).toEqual({
      status: "valid",
      updatedAt: "2026-08-19T09:30:00.000Z",
    });
  });

  it("counts an invalid draft with no error list as no problems rather than crashing", () => {
    // A row can only reach this shape by hand, and a status card is not the
    // place to find out: it renders whatever it is given.
    expect(toDefinitionStatus({ valid: false, errors: null, updatedAt: "x" }, null).draft).toEqual({
      status: "invalid",
      errorCount: 0,
      errors: [],
    });
  });

  it("says which version is live without carrying its payload out", () => {
    const status = toDefinitionStatus(toStoredValidation(VALID_ROW), PUBLISHED);

    expect(status.published).toEqual({ version: 3, publishedAt: "2026-08-19T09:00:00.000Z" });
    expect(Object.keys(status.published ?? {})).not.toContain("payload");
  });

  it("calls a draft submitted after the last publication something new to publish", () => {
    // The row was submitted at 09:30, half an hour after the version went live.
    const status = toDefinitionStatus(toStoredValidation(VALID_ROW), PUBLISHED);

    expect(status.unpublishedChanges).toBe(true);
  });

  it("does not call a draft published at the same instant newer than itself", () => {
    const published = { ...PUBLISHED, publishedAt: "2026-08-19T09:30:00.000Z" };

    expect(toDefinitionStatus(toStoredValidation(VALID_ROW), published).unpublishedChanges).toBe(
      false,
    );
  });

  it("has nothing new to publish when nothing has ever been submitted", () => {
    expect(toDefinitionStatus(null, PUBLISHED).unpublishedChanges).toBe(false);
  });
});
