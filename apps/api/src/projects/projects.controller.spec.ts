import type { ProjectDto, UserDto } from "@repanel/contracts";
import { ProjectsController } from "./projects.controller";
import type { ProjectsService } from "./projects.service";

const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

describe("ProjectsController", () => {
  const asked: unknown[][] = [];
  const projects = {
    create: (ownerId: string, request: unknown) => {
      asked.push(["create", ownerId, request]);
      return Promise.resolve(PROJECT);
    },
    list: (ownerId: string) => {
      asked.push(["list", ownerId]);
      return Promise.resolve([PROJECT]);
    },
    requireOwned: (projectId: string, ownerId: string) => {
      asked.push(["requireOwned", projectId, ownerId]);
      return Promise.resolve(PROJECT);
    },
    revealActionSecret: (projectId: string, ownerId: string) => {
      asked.push(["revealActionSecret", projectId, ownerId]);
      return Promise.resolve({ secret: "wJ8kQ" });
    },
  } as unknown as ProjectsService;
  const controller = new ProjectsController(projects);

  beforeEach(() => {
    asked.length = 0;
  });

  it("creates the project for the signed-in user", async () => {
    await expect(controller.create(USER, { name: "Crewbase" } as never)).resolves.toEqual(PROJECT);

    expect(asked).toEqual([["create", "user-ada", { name: "Crewbase" }]]);
  });

  it("lists what the signed-in user owns", async () => {
    await expect(controller.list(USER)).resolves.toEqual([PROJECT]);

    expect(asked).toEqual([["list", "user-ada"]]);
  });

  it("asks for a single project as the signed-in user", async () => {
    await expect(controller.get(USER, PROJECT.id)).resolves.toEqual(PROJECT);

    expect(asked).toEqual([["requireOwned", PROJECT.id, "user-ada"]]);
  });

  it("asks for the signing secret as the signed-in user", async () => {
    await expect(controller.actionSecret(USER, PROJECT.id)).resolves.toEqual({ secret: "wJ8kQ" });

    expect(asked).toEqual([["revealActionSecret", PROJECT.id, "user-ada"]]);
  });
});
