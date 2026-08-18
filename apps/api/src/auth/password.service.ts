import { Injectable } from "@nestjs/common";
import { compare, hash } from "bcrypt";

/** Work factor. It is recorded in every hash, so raising it invalidates nothing. */
const COST = 12;

/** The only door to bcrypt. Plaintext goes in; nothing comes back out. */
@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, COST);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
