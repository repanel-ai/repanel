import type { UserDto } from "@repanel/contracts";
import { toPersonDto } from "./people.mapper";
import type { ProjectMemberRow } from "./projects.repository";

const MEMBER: ProjectMemberRow = {
  id: "6f2a1c88-2b7e-4a0d-9c31-0f5b7d2e4a10",
  projectId: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  userId: "1b7e5d02-2c0e-4a3f-9a1d-5d0b2f6c8e44",
  role: "operator",
  createdAt: new Date("2026-08-26T09:00:00.000Z"),
};

const ACCOUNT: UserDto = {
  id: MEMBER.userId,
  email: "ravi@example.com",
  name: "Ravi",
};

describe("toPersonDto", () => {
  it("puts the person and their role on the wire, and nothing else", () => {
    expect(toPersonDto(MEMBER, ACCOUNT)).toEqual({
      userId: MEMBER.userId,
      email: "ravi@example.com",
      name: "Ravi",
      role: "operator",
      addedAt: "2026-08-26T09:00:00.000Z",
    });
  });

  /** The membership's own id names a row, and a row is not the wire's business. */
  it("leaves the membership row's id behind", () => {
    expect(Object.keys(toPersonDto(MEMBER, ACCOUNT))).not.toContain("id");
  });
});
