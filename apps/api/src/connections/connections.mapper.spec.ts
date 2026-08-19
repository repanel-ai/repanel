import { toConnectionDto } from "./connections.mapper";
import type { ConnectionRow } from "./connections.repository";

const DSN = "postgres://admin:hunter2@db.example.com:5432/skyscout";

const ROW: ConnectionRow = {
  id: "3a7f1e20-4b8c-4d15-9e63-1a2b3c4d5e6f",
  projectId: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  kind: "postgres",
  encryptedDsn: "v1.EjRWeBI0VngSNFZ4.EjRWeBI0VngSNFZ4EjRWeA==.3q2+7w==",
  createdAt: new Date("2026-08-18T12:00:00.000Z"),
  updatedAt: new Date("2026-08-19T09:30:00.000Z"),
};

describe("toConnectionDto", () => {
  it("describes the database without handing over the way in", () => {
    expect(toConnectionDto(ROW, DSN)).toEqual({
      kind: "postgres",
      host: "db.example.com",
      database: "skyscout",
    });
  });

  it("keeps the credential out of everything it returns", () => {
    const rendered = JSON.stringify(toConnectionDto(ROW, DSN));

    expect(rendered).not.toContain("hunter2");
    expect(rendered).not.toContain("admin");
    expect(rendered).not.toContain("5432");
  });

  it("leaves the row's own identifiers and its ciphertext behind", () => {
    expect(Object.keys(toConnectionDto(ROW, DSN))).toEqual(["kind", "host", "database"]);
  });
});
