import { createHash } from "node:crypto";
import { AGENT_TOKEN_PATTERN, createAgentToken, hashAgentToken } from "./agent-token";

describe("createAgentToken", () => {
  it("mints a token in the published format", () => {
    expect(createAgentToken()).toMatch(AGENT_TOKEN_PATTERN);
  });

  it("says what it is to anyone who finds one", () => {
    expect(createAgentToken().startsWith("rpk_")).toBe(true);
  });

  it("does not mint the same token twice", () => {
    const minted = new Set(Array.from({ length: 200 }, createAgentToken));

    expect(minted.size).toBe(200);
  });
});

describe("hashAgentToken", () => {
  it("answers the same digest for the same token", () => {
    const token = createAgentToken();

    expect(hashAgentToken(token)).toBe(hashAgentToken(token));
  });

  it("keeps the token out of its own digest", () => {
    const token = createAgentToken();

    const digest = hashAgentToken(token);

    expect(digest).not.toContain(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is the sha256 of the token, so a leaked row cannot be replayed", () => {
    const token = createAgentToken();

    expect(hashAgentToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
  });
});

describe("AGENT_TOKEN_PATTERN", () => {
  it("refuses anything that is not a token, before a database is asked", () => {
    for (const candidate of ["", "rpk_", "Bearer rpk_x", "rpk_short", `rpk_${"a".repeat(41)}`]) {
      expect(AGENT_TOKEN_PATTERN.test(candidate)).toBe(false);
    }
  });
});
