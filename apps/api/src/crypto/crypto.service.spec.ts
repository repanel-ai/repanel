import type { ConfigService } from "../config/config.service";
import { CryptoService } from "./crypto.service";

const DSN = "postgres://admin:hunter2@db.example.com:5432/skyscout";

/** A service holding one key. The tests need two, to tell them apart. */
function cryptoWithKey(fill: number): CryptoService {
  const appEncryptionKey = Buffer.alloc(32, fill).toString("base64");
  return new CryptoService({ appEncryptionKey } as unknown as ConfigService);
}

/** The parts a payload is made of, ready to be put back together edited. */
function partsOf(payload: string): [string, string, string, string] {
  const [version, iv, tag, ciphertext] = payload.split(".");
  return [version ?? "", iv ?? "", tag ?? "", ciphertext ?? ""];
}

/** The same payload with one byte of the named part flipped. */
function tamperWith(payload: string, part: 1 | 2 | 3): string {
  const parts = partsOf(payload);
  const bytes = Buffer.from(parts[part], "base64");
  bytes.writeUInt8(bytes.readUInt8(0) ^ 0xff, 0);
  parts[part] = bytes.toString("base64");
  return parts.join(".");
}

describe("CryptoService", () => {
  let crypto: CryptoService;

  beforeEach(() => {
    crypto = cryptoWithKey(1);
  });

  describe("encrypt", () => {
    it("reads back exactly what was encrypted", () => {
      expect(crypto.decrypt(crypto.encrypt(DSN))).toBe(DSN);
    });

    it("carries no trace of the plaintext", () => {
      const payload = crypto.encrypt(DSN);

      expect(payload).not.toContain("hunter2");
      expect(payload).not.toContain("db.example.com");
    });

    it("says which format it wrote, and packs the iv and tag alongside", () => {
      const [version, iv, tag] = partsOf(crypto.encrypt(DSN));

      expect(version).toBe("v1");
      expect(Buffer.from(iv, "base64")).toHaveLength(12);
      expect(Buffer.from(tag, "base64")).toHaveLength(16);
    });

    it("encrypts one value twice into two different payloads", () => {
      // A fresh iv each time, so equal plaintexts are not visibly equal.
      expect(crypto.encrypt(DSN)).not.toBe(crypto.encrypt(DSN));
    });

    it("handles a plaintext that is not plain ascii", () => {
      const value = "postgres://admin:pässwörd–ü@db.example.com/skyscout";

      expect(crypto.decrypt(crypto.encrypt(value))).toBe(value);
    });
  });

  describe("decrypt", () => {
    it("refuses a payload whose ciphertext was edited", () => {
      expect(() => crypto.decrypt(tamperWith(crypto.encrypt(DSN), 3))).toThrow(
        "Encrypted value could not be read",
      );
    });

    it("refuses a payload whose tag was edited", () => {
      expect(() => crypto.decrypt(tamperWith(crypto.encrypt(DSN), 2))).toThrow(
        "Encrypted value could not be read",
      );
    });

    it("refuses a payload whose iv was edited", () => {
      expect(() => crypto.decrypt(tamperWith(crypto.encrypt(DSN), 1))).toThrow(
        "Encrypted value could not be read",
      );
    });

    it("refuses a payload whose tag has been shortened", () => {
      const [version, iv, tag, ciphertext] = partsOf(crypto.encrypt(DSN));
      const shortened = Buffer.from(tag, "base64").subarray(0, 4).toString("base64");

      // Node would happily verify against four bytes; four bytes is not a tag.
      expect(() => crypto.decrypt([version, iv, shortened, ciphertext].join("."))).toThrow(
        "Encrypted value could not be read",
      );
    });

    it("refuses a payload whose iv is not the length it writes", () => {
      const [version, iv, tag, ciphertext] = partsOf(crypto.encrypt(DSN));
      const shortened = Buffer.from(iv, "base64").subarray(0, 8).toString("base64");

      expect(() => crypto.decrypt([version, shortened, tag, ciphertext].join("."))).toThrow(
        "Encrypted value could not be read",
      );
    });

    it("refuses a payload encrypted under another key", () => {
      const payload = cryptoWithKey(2).encrypt(DSN);

      expect(() => crypto.decrypt(payload)).toThrow("Encrypted value could not be read");
    });

    it("refuses a payload written in a format it does not speak", () => {
      const [, ...parts] = partsOf(crypto.encrypt(DSN));

      expect(() => crypto.decrypt(["v2", ...parts].join("."))).toThrow(
        "Encrypted value could not be read",
      );
    });

    it("refuses anything that is not a payload at all", () => {
      for (const payload of ["", "v1", "v1.only.three", DSN]) {
        expect(() => crypto.decrypt(payload)).toThrow("Encrypted value could not be read");
      }
    });

    it("says the same thing however it failed", () => {
      // Told apart, the messages would say whether a key or a value was wrong.
      const edited = failureFrom(() => crypto.decrypt(tamperWith(crypto.encrypt(DSN), 3)));
      const foreign = failureFrom(() => crypto.decrypt(cryptoWithKey(2).encrypt(DSN)));

      expect(edited.message).toBe(foreign.message);
    });
  });
});

/** The error a call failed with; fails the test if it did not fail. */
function failureFrom(call: () => unknown): Error {
  try {
    call();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}
