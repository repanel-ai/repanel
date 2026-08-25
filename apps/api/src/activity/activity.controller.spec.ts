import type { ActivityListDto, UserDto } from "@repanel/contracts";
import { ActivityController } from "./activity.controller";
import type { ActivityService } from "./activity.service";

const USER: UserDto = {
  id: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
  email: "owner@acme.test",
  name: "Ada",
};

const PAGE: ActivityListDto = { events: [], total: 0, page: 1, pageSize: 5 };

describe("ActivityController", () => {
  const activity = { listForRecord: jest.fn().mockResolvedValue(PAGE) };
  const controller = new ActivityController(activity as unknown as ActivityService);

  it("reads the record's own history, as the signed-in owner", async () => {
    await expect(
      controller.list(USER, "crewbase-a3k9x2", "airlines", "air-1", { page: 2, pageSize: 5 }),
    ).resolves.toBe(PAGE);

    expect(activity.listForRecord).toHaveBeenCalledWith(USER.id, "crewbase-a3k9x2", "airlines", "air-1", {
      page: 2,
      pageSize: 5,
    });
  });
});
