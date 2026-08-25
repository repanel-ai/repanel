import type {
  DefinitionStatusDto,
  DefinitionSubmissionDto,
  PublishedDefinitionDto,
  UserDto,
} from "@repanel/contracts";
import { DefinitionsController } from "./definitions.controller";
import type { DefinitionsService } from "./definitions.service";

const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const STATUS: DefinitionStatusDto = {
  draft: { status: "valid", updatedAt: "2026-08-19T09:30:00.000Z" },
  published: { version: 1, publishedAt: "2026-08-19T09:31:00.000Z" },
  unpublishedChanges: false,
};
const PUBLISHED: PublishedDefinitionDto = {
  version: 2,
  publishedAt: "2026-08-19T10:00:00.000Z",
};
const SUBMITTED: DefinitionSubmissionDto = {
  valid: true,
  adminUrl: "https://admin.repanel.test/a/crewbase-a3k9x2",
};
const DEFINITION = { schemaVersion: "0.1" };

describe("DefinitionsController", () => {
  const asked: unknown[][] = [];
  const definitions = {
    status: (ownerId: string, projectId: string) => {
      asked.push(["status", ownerId, projectId]);
      return Promise.resolve(STATUS);
    },
    submit: (ownerId: string, projectId: string, payload: unknown) => {
      asked.push(["submit", ownerId, projectId, payload]);
      return Promise.resolve(SUBMITTED);
    },
    publish: (ownerId: string, projectId: string) => {
      asked.push(["publish", ownerId, projectId]);
      return Promise.resolve(PUBLISHED);
    },
  } as unknown as DefinitionsService;
  const controller = new DefinitionsController(definitions);

  it("reports the status of the signed-in user's project", async () => {
    await expect(controller.status(USER, PROJECT_ID)).resolves.toEqual(STATUS);

    expect(asked).toEqual([["status", "user-ada", PROJECT_ID]]);
  });

  it("submits the body as the signed-in user, unparsed", async () => {
    asked.length = 0;

    await expect(controller.submit(USER, PROJECT_ID, DEFINITION)).resolves.toEqual(SUBMITTED);

    expect(asked).toEqual([["submit", "user-ada", PROJECT_ID, DEFINITION]]);
  });

  it("publishes the signed-in user's draft", async () => {
    asked.length = 0;

    await expect(controller.publish(USER, PROJECT_ID)).resolves.toEqual(PUBLISHED);

    expect(asked).toEqual([["publish", "user-ada", PROJECT_ID]]);
  });
});
