import type { UserDto } from "@repanel/contracts";
import { ActionsController } from "./actions.controller";
import type { ActionsService } from "./actions.service";

const USER: UserDto = {
  id: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
  email: "owner@acme.test",
  name: "Ada",
};

describe("ActionsController", () => {
  const actions = { run: jest.fn().mockResolvedValue({ ok: true, label: "Suspend" }) };
  const controller = new ActionsController(actions as unknown as ActionsService);

  it("runs the action the address names, as the signed-in owner", async () => {
    await expect(
      controller.run(USER, "crewbase-a3k9x2", "users", "user-1", "suspend"),
    ).resolves.toEqual({ ok: true, label: "Suspend" });

    expect(actions.run).toHaveBeenCalledWith(
      USER.id,
      "crewbase-a3k9x2",
      "users",
      "user-1",
      "suspend",
    );
  });
});
