import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const passwords = new PasswordService();

  it("hashes with bcrypt at cost 12 and keeps no trace of the plaintext", async () => {
    const hash = await passwords.hash("correct horse battery staple");

    expect(hash).toMatch(/^\$2[ab]\$12\$/);
    expect(hash).not.toContain("correct horse");
  });

  it("accepts the right password and rejects the wrong one", async () => {
    const hash = await passwords.hash("correct horse");

    await expect(passwords.verify("correct horse", hash)).resolves.toBe(true);
    await expect(passwords.verify("Correct horse", hash)).resolves.toBe(false);
  });

  it("salts, so the same password twice gives two different hashes", async () => {
    expect(await passwords.hash("correct horse")).not.toBe(await passwords.hash("correct horse"));
  });
});
