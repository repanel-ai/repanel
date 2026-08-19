import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "../config/config.service";

/** Authenticated encryption: a value that decrypts is a value nobody edited. */
const ALGORITHM = "aes-256-gcm";

/** What GCM is specified for. A different length is a different construction. */
const IV_BYTES = 12;

/** GCM's full tag. Node will verify against a shorter one; a shorter one is a
 *  weaker one, so a stored value is held to the length this service writes. */
const TAG_BYTES = 16;

/** Names the format below, so a second one can arrive without ambiguity. */
const VERSION = "v1";

/** One answer for everything unreadable: which part failed is nobody's business. */
const UNREADABLE = "Encrypted value could not be read";

/**
 * The only door to encryption at rest, with one key and one format:
 * `v1.<iv>.<tag>.<ciphertext>`, each part base64. A stored value carries
 * everything needed to read it back except the key, which never leaves here.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.appEncryptionKey, "base64");
  }

  /** A fresh IV every time, so encrypting one value twice looks like two. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

    const parts = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64"));
    return [VERSION, ...parts].join(".");
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ciphertext, ...rest] = payload.split(".");
    if (version !== VERSION || !iv || !tag || !ciphertext || rest.length > 0) {
      throw new Error(UNREADABLE);
    }

    const nonce = Buffer.from(iv, "base64");
    const authTag = Buffer.from(tag, "base64");
    if (nonce.byteLength !== IV_BYTES || authTag.byteLength !== TAG_BYTES) {
      throw new Error(UNREADABLE);
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, nonce);
      decipher.setAuthTag(authTag);
      // A wrong key, an edited tag and an edited ciphertext all land here:
      // GCM checks the tag as it finishes, and refuses rather than guessing.
      return (
        decipher.update(Buffer.from(ciphertext, "base64"), undefined, "utf8") +
        decipher.final("utf8")
      );
    } catch {
      throw new Error(UNREADABLE);
    }
  }
}
