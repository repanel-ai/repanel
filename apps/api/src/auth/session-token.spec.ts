import { createSessionToken, hashSessionToken } from "./session-token";

describe("session tokens", () => {
  it("mints 256 bits of fresh randomness every time", () => {
    const tokens = Array.from({ length: 100 }, createSessionToken);

    expect(new Set(tokens).size).toBe(tokens.length);
    expect(Buffer.from(tokens[0] ?? "", "base64url")).toHaveLength(32);
  });

  it("hashes a token to a stable digest that is not the token", () => {
    const token = createSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives two tokens two digests", () => {
    expect(hashSessionToken(createSessionToken())).not.toBe(
      hashSessionToken(createSessionToken()),
    );
  });
});
