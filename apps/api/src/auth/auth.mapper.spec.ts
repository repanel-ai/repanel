import { toUserDto } from "./auth.mapper";
import type { UserRow } from "./auth.repository";

const row: UserRow = {
  id: "0f9d3c1e-6b1a-4f5e-9c2b-3a7d8e1f2a4b",
  email: "ada@example.com",
  passwordHash: "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4ZK2rG1Y3PT0oCoq7hZ4qYbXqL8Zq8u",
  name: "Ada",
  createdAt: new Date("2026-08-18T20:00:00.000Z"),
};

describe("toUserDto", () => {
  it("carries only what a client may see", () => {
    expect(toUserDto(row)).toEqual({ id: row.id, email: row.email, name: row.name });
  });

  it("leaves the password hash behind", () => {
    const dto = toUserDto(row);

    expect(Object.keys(dto)).toEqual(["id", "email", "name"]);
    expect("passwordHash" in dto).toBe(false);
    expect(JSON.stringify(dto)).not.toContain(row.passwordHash);
  });

  it("leaves persistence-only columns behind", () => {
    expect(JSON.stringify(toUserDto(row))).not.toContain("createdAt");
  });
});
