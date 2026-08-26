import { Test } from "@nestjs/testing";
import type { ProjectDto, ProjectRole } from "@repanel/contracts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { AGENT_TOKEN_PATTERN, hashAgentToken } from "./agent-token";
import {
  AgentTokensRepository,
  type AgentTokenRow,
  type NewAgentTokenRow,
} from "./agent-tokens.repository";
import { AgentTokensService } from "./agent-tokens.service";

const ADA = "user-ada";
const GRACE = "user-grace";
/** On Crewbase, but only to use its admin. */
const RAVI = "user-ravi";
const CREWBASE = "project-crewbase";

const PROJECT: ProjectDto = {
  id: CREWBASE,
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

type TokenStore = Pick<AgentTokensRepository, "create" | "listByProjectId" | "recordUse">;

/** Stands in for Postgres, down to the clock the `last_used_at` column reads. */
class InMemoryAgentTokensRepository implements TokenStore {
  readonly rows: AgentTokenRow[] = [];
  /** Every digest the service has looked up, in the order it looked them up. */
  readonly lookups: string[] = [];

  create(token: NewAgentTokenRow): Promise<AgentTokenRow> {
    const created: AgentTokenRow = {
      id: `token-${this.rows.length + 1}`,
      projectId: token.projectId,
      tokenHash: token.tokenHash,
      label: token.label,
      createdAt: new Date("2026-08-19T10:00:00.000Z"),
      lastUsedAt: null,
    };
    this.rows.push(created);
    return Promise.resolve(created);
  }

  listByProjectId(projectId: string): Promise<AgentTokenRow[]> {
    return Promise.resolve(this.rows.filter((row) => row.projectId === projectId));
  }

  recordUse(tokenHash: string): Promise<AgentTokenRow | undefined> {
    this.lookups.push(tokenHash);
    const found = this.rows.find((row) => row.tokenHash === tokenHash);
    if (found) found.lastUsedAt = new Date("2026-08-19T11:00:00.000Z");
    return Promise.resolve(found);
  }

  /** The only revocation there is: the row goes, and the token stops working. */
  revoke(id: string): void {
    this.rows.splice(
      this.rows.findIndex((row) => row.id === id),
      1,
    );
  }
}

/** Stands in for the projects feature: Ada owns Crewbase, Ravi operates it. */
class MemberProjects implements Pick<ProjectsService, "requireMember"> {
  requireMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectDto> {
    if (projectId !== CREWBASE) return Promise.reject(new NotFoundError("Project not found"));
    if (userId === ADA) return Promise.resolve(PROJECT);
    if (userId !== RAVI) return Promise.reject(new NotFoundError("Project not found"));

    return role === "operator"
      ? Promise.resolve(PROJECT)
      : Promise.reject(new ForbiddenError("Only this project's owner can do that"));
  }
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("AgentTokensService", () => {
  let repository: InMemoryAgentTokensRepository;
  let service: AgentTokensService;

  beforeEach(async () => {
    repository = new InMemoryAgentTokensRepository();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentTokensService,
        { provide: AgentTokensRepository, useValue: repository },
        { provide: ProjectsService, useValue: new MemberProjects() },
      ],
    }).compile();

    service = moduleRef.get(AgentTokensService);
  });

  describe("mint", () => {
    it("hands the owner a token in the published format, once", async () => {
      const minted = await service.mint(ADA, CREWBASE, { label: "Claude Code" });

      expect(minted.token).toMatch(AGENT_TOKEN_PATTERN);
      expect(minted.label).toBe("Claude Code");
      expect(minted.lastUsedAt).toBeNull();
    });

    it("keeps only the digest, so the minting response is the only copy", async () => {
      const minted = await service.mint(ADA, CREWBASE, { label: "Claude Code" });

      expect(repository.rows[0]?.tokenHash).toBe(hashAgentToken(minted.token));
      expect(JSON.stringify(repository.rows)).not.toContain(minted.token);
    });

    it("never mints the same token for two labels", async () => {
      const first = await service.mint(ADA, CREWBASE, { label: "Laptop" });
      const second = await service.mint(ADA, CREWBASE, { label: "CI" });

      expect(first.token).not.toBe(second.token);
    });

    it("answers minting into someone else's project as missing, and stores nothing", async () => {
      const refusal = await refusalFrom(service.mint(GRACE, CREWBASE, { label: "Claude Code" }));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
    });
  });

  describe("list", () => {
    it("shows the owner their tokens without the tokens", async () => {
      const minted = await service.mint(ADA, CREWBASE, { label: "Claude Code" });

      const listed = await service.list(ADA, CREWBASE);

      expect(listed).toEqual([
        {
          id: "token-1",
          label: "Claude Code",
          createdAt: "2026-08-19T10:00:00.000Z",
          lastUsedAt: null,
        },
      ]);
      expect(JSON.stringify(listed)).not.toContain(minted.token);
    });

    it("answers a project the caller does not own as missing", async () => {
      const refusal = await refusalFrom(service.list(GRACE, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers a project with no tokens with an empty list", async () => {
      await expect(service.list(ADA, CREWBASE)).resolves.toEqual([]);
    });
  });

  describe("principalFor", () => {
    it("answers with the agent the token speaks for", async () => {
      const minted = await service.mint(ADA, CREWBASE, { label: "Claude Code" });

      await expect(service.principalFor(minted.token)).resolves.toEqual({
        kind: "agent",
        projectId: CREWBASE,
      });
    });

    it("records that the token was used", async () => {
      const minted = await service.mint(ADA, CREWBASE, { label: "Claude Code" });
      expect(repository.rows[0]?.lastUsedAt).toBeNull();

      await service.principalFor(minted.token);

      expect(repository.rows[0]?.lastUsedAt).toEqual(new Date("2026-08-19T11:00:00.000Z"));
      const [listed] = await service.list(ADA, CREWBASE);
      expect(listed?.lastUsedAt).toBe("2026-08-19T11:00:00.000Z");
    });

    it("refuses a token no row carries", async () => {
      const refusal = await refusalFrom(service.principalFor(`rpk_${"a".repeat(40)}`));

      expect(refusal).toBeInstanceOf(UnauthorizedError);
    });

    it("refuses a malformed token without asking the database", async () => {
      const refusal = await refusalFrom(service.principalFor("not-a-token"));

      expect(refusal).toBeInstanceOf(UnauthorizedError);
      expect(repository.lookups).toEqual([]);
    });

    it("refuses a token whose row has been deleted", async () => {
      const minted = await service.mint(ADA, CREWBASE, { label: "Claude Code" });
      await service.principalFor(minted.token);

      repository.revoke("token-1");

      const refusal = await refusalFrom(service.principalFor(minted.token));
      expect(refusal).toBeInstanceOf(UnauthorizedError);
    });

    it("says the same thing however the token is unusable", async () => {
      const malformed = await refusalFrom(service.principalFor("nonsense"));
      const unknown = await refusalFrom(service.principalFor(`rpk_${"b".repeat(40)}`));

      // Told apart, the two would let a caller learn which tokens exist.
      expect(unknown.message).toBe(malformed.message);
    });
  });
});
