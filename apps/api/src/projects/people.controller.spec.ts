import type { UserDto } from "@repanel/contracts";
import { PeopleController } from "./people.controller";
import type { PeopleService } from "./people.service";

const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const PERSON = {
  userId: "user-ravi",
  email: "ravi@example.com",
  name: "Ravi",
  role: "operator" as const,
  addedAt: "2026-08-26T09:00:00.000Z",
};

describe("PeopleController", () => {
  const asked: unknown[][] = [];
  const people = {
    list: (ownerId: string, projectId: string) => {
      asked.push(["list", ownerId, projectId]);
      return Promise.resolve([PERSON]);
    },
    addOperator: (ownerId: string, projectId: string, body: unknown) => {
      asked.push(["addOperator", ownerId, projectId, body]);
      return Promise.resolve({ person: PERSON, password: "Nq2Xr7fL8kPa1ZbYc3Dm" });
    },
    revoke: (ownerId: string, projectId: string, userId: string) => {
      asked.push(["revoke", ownerId, projectId, userId]);
      return Promise.resolve();
    },
  } as unknown as PeopleService;
  const controller = new PeopleController(people);

  beforeEach(() => {
    asked.length = 0;
  });

  it("lists the project's people as the signed-in user", async () => {
    await expect(controller.list(USER, PROJECT_ID)).resolves.toEqual([PERSON]);

    expect(asked).toEqual([["list", "user-ada", PROJECT_ID]]);
  });

  it("adds an operator as the signed-in user, and passes the password back", async () => {
    const body = { email: "ravi@example.com", name: "Ravi" };

    await expect(controller.add(USER, PROJECT_ID, body as never)).resolves.toEqual({
      person: PERSON,
      password: "Nq2Xr7fL8kPa1ZbYc3Dm",
    });
    expect(asked).toEqual([["addOperator", "user-ada", PROJECT_ID, body]]);
  });

  it("revokes as the signed-in user, and answers with nothing", async () => {
    await expect(controller.revoke(USER, PROJECT_ID, "user-ravi")).resolves.toBeUndefined();

    expect(asked).toEqual([["revoke", "user-ada", PROJECT_ID, "user-ravi"]]);
  });
});
