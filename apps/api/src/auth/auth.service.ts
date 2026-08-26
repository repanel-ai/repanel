import { Injectable } from "@nestjs/common";
import type { LoginRequest, SignupRequest, UserDto } from "@repanel/contracts";
import { ConflictError, UnauthorizedError } from "../errors/domain-errors";
import { toUserDto } from "./auth.mapper";
import { AuthRepository, type UserRow } from "./auth.repository";
import { PasswordService } from "./password.service";
import { createSessionToken, hashSessionToken } from "./session-token";

/** How long a session lives. Sessions do not slide: 30 days from sign-in, then out. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A session, and the raw token whoever asked for it must be handed back. */
export interface MintedSession {
  token: string;
  expiresAt: Date;
}

/** A signed-in user, plus the raw token the caller must be handed back. */
export interface AuthenticatedSession extends MintedSession {
  user: UserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
  ) {}

  async signup(request: SignupRequest): Promise<AuthenticatedSession> {
    const user = await this.createAccount(request);
    return { user, ...(await this.mintSession(user.id)) };
  }

  /**
   * An account, without a session for it. Signing up is one caller; an owner
   * putting an operator on a project is the other, and what that owner is
   * handed is the person, never a way to act as them.
   */
  async createAccount(request: SignupRequest): Promise<UserDto> {
    if (await this.repository.findUserByEmail(request.email)) {
      throw new ConflictError("Email already registered");
    }

    return toUserDto(
      await this.repository.createUser({
        email: request.email,
        name: request.name,
        passwordHash: await this.passwords.hash(request.password),
      }),
    );
  }

  /** The account at this address, or null. Nothing about it but who they are. */
  async findAccountByEmail(email: string): Promise<UserDto | null> {
    const user = await this.repository.findUserByEmail(email);
    return user ? toUserDto(user) : null;
  }

  /** The people these ids name, for a caller that holds ids and needs names. */
  async accountsFor(userIds: string[]): Promise<UserDto[]> {
    const users = await this.repository.findUsersByIds(userIds);
    return users.map(toUserDto);
  }

  async login({ email, password }: LoginRequest): Promise<AuthenticatedSession> {
    const user = await this.repository.findUserByEmail(email);
    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      // One message for both halves: a caller must not learn which was wrong.
      throw new UnauthorizedError("Email or password is incorrect");
    }

    return this.startSession(user);
  }

  /** Ends the session a token names. Logging out without one is not an error. */
  async logout(token: string | undefined): Promise<void> {
    if (token) await this.repository.deleteSessionByTokenHash(hashSessionToken(token));
  }

  /** Resolves a session token to the user behind it, or refuses. */
  async userForSession(token: string): Promise<UserDto> {
    const found = await this.repository.findSessionByTokenHash(hashSessionToken(token));
    if (!found || found.session.expiresAt <= new Date()) {
      throw new UnauthorizedError("Session is invalid or has expired");
    }

    return toUserDto(found.user);
  }

  /**
   * A session for a user who is already known to be who they say they are.
   * Signing in is one caller; the console authorizing the `repanel` CLI on
   * this account's machine is the other, and what it is handed is an ordinary
   * session — same lifetime, same table, ended by the same logout.
   */
  async mintSession(userId: string): Promise<MintedSession> {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.repository.createSession({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

    return { token, expiresAt };
  }

  private async startSession(user: UserRow): Promise<AuthenticatedSession> {
    return { user: toUserDto(user), ...(await this.mintSession(user.id)) };
  }
}
