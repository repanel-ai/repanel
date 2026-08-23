import type { DefinitionStatusDto, UserDto } from "@repanel/contracts";
import { DefinitionsController } from "./definitions.controller";
import type { DefinitionsService } from "./definitions.service";

const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const STATUS: DefinitionStatusDto = { status: "valid", updatedAt: "2026-08-19T09:30:00.000Z" };

describe("DefinitionsController", () => {
  const asked: unknown[][] = [];
  const definitions = {
    status: (ownerId: string, projectId: string) => {
      asked.push(["status", ownerId, projectId]);
      return Promise.resolve(STATUS);
    },
  } as unknown as DefinitionsService;
  const controller = new DefinitionsController(definitions);

  it("reports the status of the signed-in user's project", async () => {
    await expect(controller.status(USER, PROJECT_ID)).resolves.toEqual(STATUS);

    expect(asked).toEqual([["status", "user-ada", PROJECT_ID]]);
  });
});
