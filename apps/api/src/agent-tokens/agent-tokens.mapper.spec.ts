import { toAgentTokenDto, toMintedAgentTokenDto } from "./agent-tokens.mapper";
import type { AgentTokenRow } from "./agent-tokens.repository";

const ROW: AgentTokenRow = {
  id: "0f2b1c44-9a3d-4f21-8b6e-5c9d0e7a1b22",
  projectId: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  tokenHash: "9f".repeat(32),
  label: "Claude Code",
  createdAt: new Date("2026-08-18T12:00:00.000Z"),
  lastUsedAt: new Date("2026-08-19T09:30:00.000Z"),
};

const UNUSED: AgentTokenRow = { ...ROW, lastUsedAt: null };

describe("toAgentTokenDto", () => {
  it("renders the row as the shape the API hands out", () => {
    expect(toAgentTokenDto(ROW)).toEqual({
      id: ROW.id,
      label: "Claude Code",
      createdAt: "2026-08-18T12:00:00.000Z",
      lastUsedAt: "2026-08-19T09:30:00.000Z",
    });
  });

  it("leaves the digest and the project behind", () => {
    const dto = toAgentTokenDto(ROW);

    expect(Object.keys(dto)).toEqual(["id", "label", "createdAt", "lastUsedAt"]);
    expect(JSON.stringify(dto)).not.toContain(ROW.tokenHash);
  });

  it("reports a token that has never been used as never used", () => {
    expect(toAgentTokenDto(UNUSED).lastUsedAt).toBeNull();
  });
});

describe("toMintedAgentTokenDto", () => {
  it("carries the plaintext the row does not have", () => {
    const minted = toMintedAgentTokenDto(UNUSED, "rpk_plaintext");

    expect(minted).toEqual({ ...toAgentTokenDto(UNUSED), token: "rpk_plaintext" });
  });

  it("still leaves the digest behind", () => {
    expect(JSON.stringify(toMintedAgentTokenDto(ROW, "rpk_plaintext"))).not.toContain(
      ROW.tokenHash,
    );
  });
});
