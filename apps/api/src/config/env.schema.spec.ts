import { validateEnv } from "./env.schema";

const DATABASE_URL = "postgres://repanel:repanel@localhost:5432/repanel";

describe("validateEnv", () => {
  it("fills in defaults and gives PORT back as a number", () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_URL,
    });
  });

  it("names every offending variable in one message", () => {
    expect(() => validateEnv({ NODE_ENV: "staging", PORT: "http", DATABASE_URL: "localhost" }))
      .toThrow(/NODE_ENV[\s\S]*PORT[\s\S]*DATABASE_URL/);
  });

  it("refuses to boot without a database", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
