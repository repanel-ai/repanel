import type { RecordDto, UserDto } from "@repanel/contracts";
import { RecordsController } from "./records.controller";
import type { RecordsService } from "./records.service";

const USER: UserDto = {
  id: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
  email: "owner@acme.test",
  name: "Ada",
};

const RECORD: RecordDto = { id: "u_1", values: { name: "Ada" } };

describe("RecordsController", () => {
  const records = {
    createRecord: jest.fn().mockResolvedValue(RECORD),
    updateRecord: jest.fn().mockResolvedValue(RECORD),
  };
  const controller = new RecordsController(records as unknown as RecordsService);

  it("creates a record of the resource the address names, as the signed-in owner", async () => {
    await expect(
      controller.create(USER, "crewbase-a3k9x2", "users", { values: { name: "Ada" } }),
    ).resolves.toBe(RECORD);

    expect(records.createRecord).toHaveBeenCalledWith(USER.id, "crewbase-a3k9x2", "users", {
      values: { name: "Ada" },
    });
  });

  it("updates the record the address names", async () => {
    await expect(
      controller.update(USER, "crewbase-a3k9x2", "users", "u_1", { values: { name: "Ada" } }),
    ).resolves.toBe(RECORD);

    expect(records.updateRecord).toHaveBeenCalledWith(USER.id, "crewbase-a3k9x2", "users", "u_1", {
      values: { name: "Ada" },
    });
  });
});
