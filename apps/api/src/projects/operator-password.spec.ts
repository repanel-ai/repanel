import { createOperatorPassword } from "./operator-password";

describe("createOperatorPassword", () => {
  it("draws twenty base62 characters", () => {
    expect(createOperatorPassword()).toMatch(/^[A-Za-z0-9]{20}$/);
  });

  it("draws a different one every time", () => {
    const drawn = new Set(Array.from({ length: 50 }, createOperatorPassword));

    expect(drawn.size).toBe(50);
  });

  /**
   * The login schema takes 8 to 72 characters, and bcrypt reads the first 72
   * bytes. A password nobody can sign in with would be a screen that lies.
   */
  it("is a password the login route would accept, in full", () => {
    const password = createOperatorPassword();

    expect(password.length).toBeGreaterThanOrEqual(8);
    expect(Buffer.byteLength(password, "utf8")).toBeLessThanOrEqual(72);
  });
});
