import { validateEnv } from "./env.schema";

const DATABASE_URL = "postgres://repanel:repanel@localhost:5432/repanel";
const APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("validateEnv", () => {
  it("fills in defaults and gives PORT back as a number", () => {
    expect(validateEnv({ DATABASE_URL, APP_ENCRYPTION_KEY })).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_URL,
      CONSOLE_URL: "http://localhost:5173",
      APP_ENCRYPTION_KEY,
    });
  });

  it("names every offending variable in one message", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "staging",
        PORT: "http",
        DATABASE_URL: "localhost",
        APP_ENCRYPTION_KEY: "not base64",
      }),
    ).toThrow(/NODE_ENV[\s\S]*PORT[\s\S]*DATABASE_URL[\s\S]*APP_ENCRYPTION_KEY/);
  });

  it("refuses to boot without a database", () => {
    expect(() => validateEnv({ APP_ENCRYPTION_KEY })).toThrow(/DATABASE_URL/);
  });

  it("refuses to boot without a key to encrypt customer connections with", () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("refuses a key that is well-formed base64 of the wrong length", () => {
    const short = Buffer.alloc(16).toString("base64");

    expect(() => validateEnv({ DATABASE_URL, APP_ENCRYPTION_KEY: short })).toThrow(
      /APP_ENCRYPTION_KEY: must be 32 random bytes/,
    );
  });

  it("hands the suite a key of its own, so tests configure no secrets", () => {
    const env = validateEnv({ NODE_ENV: "test", DATABASE_URL });

    expect(Buffer.from(env.APP_ENCRYPTION_KEY, "base64")).toHaveLength(32);
  });

  it("still takes a real key under test when one is given", () => {
    const env = validateEnv({ NODE_ENV: "test", DATABASE_URL, APP_ENCRYPTION_KEY });

    expect(env.APP_ENCRYPTION_KEY).toBe(APP_ENCRYPTION_KEY);
  });

  it("drops a trailing slash from the console URL, because links are built onto it", () => {
    const env = validateEnv({
      DATABASE_URL,
      APP_ENCRYPTION_KEY,
      CONSOLE_URL: "https://console.repanel.app/",
    });

    expect(env.CONSOLE_URL).toBe("https://console.repanel.app");
  });

  it("refuses a console URL that is not a URL", () => {
    expect(() =>
      validateEnv({ DATABASE_URL, APP_ENCRYPTION_KEY, CONSOLE_URL: "console.repanel.app" }),
    ).toThrow(/CONSOLE_URL/);
  });
});
