import type { AgentTokenDto, MintedAgentTokenDto, UserDto } from "@repanel/contracts";
import { AgentTokensController } from "./agent-tokens.controller";
import type { AgentTokensService } from "./agent-tokens.service";

const USER: UserDto = { id: "user-ada", email: "ada@example.com", name: "Ada" };
const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const TOKEN: AgentTokenDto = {
  id: "0f2b1c44-9a3d-4f21-8b6e-5c9d0e7a1b22",
  label: "Claude Code",
  createdAt: "2026-08-19T10:00:00.000Z",
  lastUsedAt: null,
};

const MINTED: MintedAgentTokenDto = { ...TOKEN, token: `rpk_${"a".repeat(40)}` };

describe("AgentTokensController", () => {
  const asked: unknown[][] = [];
  const tokens = {
    mint: (ownerId: string, projectId: string, request: unknown) => {
      asked.push(["mint", ownerId, projectId, request]);
      return Promise.resolve(MINTED);
    },
    list: (ownerId: string, projectId: string) => {
      asked.push(["list", ownerId, projectId]);
      return Promise.resolve([TOKEN]);
    },
  } as unknown as AgentTokensService;
  const controller = new AgentTokensController(tokens);

  beforeEach(() => {
    asked.length = 0;
  });

  it("mints a token for the signed-in user's project", async () => {
    await expect(
      controller.mint(USER, PROJECT_ID, { label: "Claude Code" } as never),
    ).resolves.toEqual(MINTED);

    expect(asked).toEqual([["mint", "user-ada", PROJECT_ID, { label: "Claude Code" }]]);
  });

  it("lists the tokens of the signed-in user's project", async () => {
    await expect(controller.list(USER, PROJECT_ID)).resolves.toEqual([TOKEN]);

    expect(asked).toEqual([["list", "user-ada", PROJECT_ID]]);
  });
});
