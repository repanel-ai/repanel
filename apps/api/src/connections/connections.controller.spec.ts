import type { ConnectionDto, ConnectionTestDto, UserDto } from "@repanel/contracts";
import { ConnectionsController } from "./connections.controller";
import type { ConnectionsService } from "./connections.service";

const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const CONNECTION: ConnectionDto = {
  kind: "postgres",
  host: "db.example.com",
  database: "crewbase",
};

const FAILED: ConnectionTestDto = { ok: false, reason: "auth_failed" };

describe("ConnectionsController", () => {
  const asked: unknown[][] = [];
  const connections = {
    set: (ownerId: string, projectId: string, request: unknown) => {
      asked.push(["set", ownerId, projectId, request]);
      return Promise.resolve(CONNECTION);
    },
    test: (ownerId: string, projectId: string) => {
      asked.push(["test", ownerId, projectId]);
      return Promise.resolve(FAILED);
    },
  } as unknown as ConnectionsService;
  const controller = new ConnectionsController(connections);

  beforeEach(() => {
    asked.length = 0;
  });

  it("sets the connection of the signed-in user's project", async () => {
    const dsn = "postgres://admin:hunter2@db.example.com:5432/crewbase";

    await expect(controller.set(USER, PROJECT_ID, { dsn } as never)).resolves.toEqual(CONNECTION);

    expect(asked).toEqual([["set", "user-ada", PROJECT_ID, { dsn }]]);
  });

  it("tests the connection of the signed-in user's project", async () => {
    await expect(controller.test(USER, PROJECT_ID)).resolves.toEqual(FAILED);

    expect(asked).toEqual([["test", "user-ada", PROJECT_ID]]);
  });
});
