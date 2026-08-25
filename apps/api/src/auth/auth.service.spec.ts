import { Test } from "@nestjs/testing";
import { ConflictError, UnauthorizedError } from "../errors/domain-errors";
import {
  AuthRepository,
  type NewSessionRow,
  type NewUserRow,
  type SessionRow,
  type SessionWithUser,
  type UserRow,
} from "./auth.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { hashSessionToken } from "./session-token";

type AuthStore = Pick<
  AuthRepository,
  | "findUserByEmail"
  | "createUser"
  | "createSession"
  | "findSessionByTokenHash"
  | "deleteSessionByTokenHash"
>;

/** Stands in for Postgres: same behavior, contents a test can look at. */
class InMemoryAuthRepository implements AuthStore {
  readonly users: UserRow[] = [];
  readonly sessions: SessionRow[] = [];

  findUserByEmail(email: string): Promise<UserRow | undefined> {
    return Promise.resolve(this.users.find((user) => user.email === email));
  }

  createUser(user: NewUserRow): Promise<UserRow> {
    const created: UserRow = {
      id: `user-${this.users.length + 1}`,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      createdAt: new Date(),
    };
    this.users.push(created);
    return Promise.resolve(created);
  }

  createSession(session: NewSessionRow): Promise<void> {
    this.sessions.push({
      id: `session-${this.sessions.length + 1}`,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      createdAt: new Date(),
    });
    return Promise.resolve();
  }

  findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | undefined> {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    const user = this.users.find((candidate) => candidate.id === session?.userId);
    return Promise.resolve(session && user ? { session, user } : undefined);
  }

  deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    const index = this.sessions.findIndex((session) => session.tokenHash === tokenHash);
    if (index !== -1) this.sessions.splice(index, 1);
    return Promise.resolve();
  }

  /** Ages a session, so the expiry path can be tested without waiting a month. */
  expire(tokenHash: string): void {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    if (session) session.expiresAt = new Date(Date.now() - 1000);
  }
}

/** Deterministic stand-in for bcrypt; `password.service.spec.ts` covers the real thing. */
class FakePasswordService implements PasswordService {
  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }
}

const SIGNUP = { email: "ada@example.com", password: "correct horse", name: "Ada" };
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("AuthService", () => {
  let repository: InMemoryAuthRepository;
  let service: AuthService;

  beforeEach(async () => {
    repository = new InMemoryAuthRepository();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: PasswordService, useValue: new FakePasswordService() },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("signup", () => {
    it("stores the user with a hashed password and opens a session", async () => {
      const session = await service.signup(SIGNUP);

      expect(session.user).toEqual({ id: "user-1", email: "ada@example.com", name: "Ada" });
      expect(repository.users).toHaveLength(1);
      expect(repository.users[0]?.passwordHash).toBe("hashed:correct horse");
      expect(repository.sessions).toHaveLength(1);
      expect(repository.sessions[0]?.userId).toBe("user-1");
    });

    it("stores the token's digest, never the token itself", async () => {
      const session = await service.signup(SIGNUP);

      expect(repository.sessions[0]?.tokenHash).toBe(hashSessionToken(session.token));
      expect(JSON.stringify(repository.sessions)).not.toContain(session.token);
    });

    it("gives the session thirty days", async () => {
      const session = await service.signup(SIGNUP);

      const lifetime = session.expiresAt.getTime() - Date.now();
      expect(lifetime).toBeLessThanOrEqual(THIRTY_DAYS_MS);
      expect(lifetime).toBeGreaterThan(THIRTY_DAYS_MS - 5_000);
      expect(repository.sessions[0]?.expiresAt).toEqual(session.expiresAt);
    });

    it("refuses an email that is already registered", async () => {
      await service.signup(SIGNUP);

      const refusal = await refusalFrom(service.signup({ ...SIGNUP, name: "Impostor" }));

      expect(refusal).toBeInstanceOf(ConflictError);
      expect(repository.users).toHaveLength(1);
      expect(repository.sessions).toHaveLength(1);
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await service.signup(SIGNUP);
    });

    it("opens a second session without disturbing the first", async () => {
      const session = await service.login({ email: SIGNUP.email, password: SIGNUP.password });

      expect(session.user.id).toBe("user-1");
      expect(repository.sessions).toHaveLength(2);
      expect(repository.sessions[1]?.tokenHash).toBe(hashSessionToken(session.token));
    });

    it("says the same thing for a wrong password as for an unknown email", async () => {
      const wrongPassword = await refusalFrom(
        service.login({ email: SIGNUP.email, password: "not it" }),
      );
      const unknownEmail = await refusalFrom(
        service.login({ email: "nobody@example.com", password: SIGNUP.password }),
      );

      expect(wrongPassword).toBeInstanceOf(UnauthorizedError);
      expect(unknownEmail).toBeInstanceOf(UnauthorizedError);
      expect(unknownEmail.message).toBe(wrongPassword.message);
      expect(repository.sessions).toHaveLength(1);
    });
  });

  describe("mintSession", () => {
    beforeEach(async () => {
      await service.signup(SIGNUP);
    });

    it("opens a session the user can be found by, without disturbing the first", async () => {
      const minted = await service.mintSession("user-1");

      await expect(service.userForSession(minted.token)).resolves.toEqual({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
      });
      expect(repository.sessions).toHaveLength(2);
    });

    it("stores the token's digest and gives it the same thirty days", async () => {
      const minted = await service.mintSession("user-1");

      expect(repository.sessions[1]?.tokenHash).toBe(hashSessionToken(minted.token));
      expect(JSON.stringify(repository.sessions)).not.toContain(minted.token);
      const lifetime = minted.expiresAt.getTime() - Date.now();
      expect(lifetime).toBeGreaterThan(THIRTY_DAYS_MS - 5_000);
    });

    it("ends where logout ends it, like any other session", async () => {
      const minted = await service.mintSession("user-1");

      await service.logout(minted.token);

      await expect(refusalFrom(service.userForSession(minted.token))).resolves.toBeInstanceOf(
        UnauthorizedError,
      );
    });
  });

  describe("userForSession", () => {
    it("answers with the user behind a live session", async () => {
      const session = await service.signup(SIGNUP);

      await expect(service.userForSession(session.token)).resolves.toEqual(session.user);
    });

    it("refuses an expired session", async () => {
      const session = await service.signup(SIGNUP);
      repository.expire(hashSessionToken(session.token));

      const refusal = await refusalFrom(service.userForSession(session.token));

      expect(refusal).toBeInstanceOf(UnauthorizedError);
    });

    it("refuses a token no session matches", async () => {
      await service.signup(SIGNUP);

      const refusal = await refusalFrom(service.userForSession("made-up-token"));

      expect(refusal).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("logout", () => {
    it("deletes the session the token names and leaves the others alone", async () => {
      const first = await service.signup(SIGNUP);
      const second = await service.login({ email: SIGNUP.email, password: SIGNUP.password });

      await service.logout(first.token);

      expect(repository.sessions).toHaveLength(1);
      expect(repository.sessions[0]?.tokenHash).toBe(hashSessionToken(second.token));
      await expect(service.userForSession(second.token)).resolves.toEqual(second.user);
    });

    it("does nothing when the caller has no session", async () => {
      await service.signup(SIGNUP);

      await service.logout(undefined);

      expect(repository.sessions).toHaveLength(1);
    });
  });
});
