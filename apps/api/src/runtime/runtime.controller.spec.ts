import type { UserDto } from "@repanel/contracts";
import { RuntimeController } from "./runtime.controller";
import type { RuntimeService } from "./runtime.service";

const USER: UserDto = {
  id: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
  email: "owner@acme.test",
  name: "Ada",
};

const QUERY = { page: 2, pageSize: 10, search: "acme" };

describe("RuntimeController", () => {
  const runtime = {
    definitionFor: jest.fn().mockResolvedValue({ schemaVersion: "0.1" }),
    listRecords: jest.fn().mockResolvedValue({ records: [], total: 0, page: 2, pageSize: 10 }),
    getRecord: jest.fn().mockResolvedValue({ id: "user-1", values: {} }),
    listRelated: jest.fn().mockResolvedValue({ records: [], total: 0, page: 2, pageSize: 10 }),
  };
  const controller = new RuntimeController(runtime as unknown as RuntimeService);

  it("reads the definition for the signed-in owner", async () => {
    await controller.definition(USER, "crewbase-a3k9x2");

    expect(runtime.definitionFor).toHaveBeenCalledWith(USER.id, "crewbase-a3k9x2");
  });

  it("passes a list request through as it was parsed", async () => {
    await controller.records(USER, "crewbase-a3k9x2", "users", QUERY);

    expect(runtime.listRecords).toHaveBeenCalledWith(USER.id, "crewbase-a3k9x2", "users", QUERY);
  });

  it("passes a record request through", async () => {
    await controller.record(USER, "crewbase-a3k9x2", "users", "user-1");

    expect(runtime.getRecord).toHaveBeenCalledWith(USER.id, "crewbase-a3k9x2", "users", "user-1");
  });

  it("passes a related request through", async () => {
    await controller.related(USER, "crewbase-a3k9x2", "users", "user-1", "orders", QUERY);

    expect(runtime.listRelated).toHaveBeenCalledWith(
      USER.id,
      "crewbase-a3k9x2",
      "users",
      "user-1",
      "orders",
      QUERY,
    );
  });
});
