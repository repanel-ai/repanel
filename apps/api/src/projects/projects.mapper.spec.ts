import { toProjectDto } from "./projects.mapper";
import type { ProjectRow } from "./projects.repository";

const ROW: ProjectRow = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  userId: "1b7e5d02-2c0e-4a3f-9a1d-5d0b2f6c8e44",
  name: "SkyScout",
  key: "skyscout-a3k9x2",
  actionSecret: "v1.aXY.dGFn.Y2lwaGVy",
  createdAt: new Date("2026-08-18T12:00:00.000Z"),
};

describe("toProjectDto", () => {
  it("renders the row as the shape the wire carries", () => {
    expect(toProjectDto(ROW)).toEqual({
      id: ROW.id,
      name: "SkyScout",
      key: "skyscout-a3k9x2",
      createdAt: "2026-08-18T12:00:00.000Z",
    });
  });

  it("leaves the owner's id behind", () => {
    expect(Object.keys(toProjectDto(ROW))).not.toContain("userId");
  });

  /**
   * The signing secret has exactly one route out of the API, and it is the
   * route that exists to hand it over. A project DTO travels everywhere.
   */
  it("leaves the signing secret behind, in any form", () => {
    const dto = toProjectDto(ROW);

    expect(Object.keys(dto)).not.toContain("actionSecret");
    expect(JSON.stringify(dto)).not.toContain("v1.");
  });
});
