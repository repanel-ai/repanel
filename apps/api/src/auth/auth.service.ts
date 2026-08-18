import { Injectable } from "@nestjs/common";
import type { LoginRequest, SignupRequest, UserDto } from "@repanel/contracts";
import { ConflictError, UnauthorizedError } from "../errors/domain-errors";
import { toUserDto } from "./auth.mapper";
import { AuthRepository, type UserRow } from "./auth.repository";
import { PasswordService } from "./password.service";
import { createSessionToken, hashSessionToken } from "./session-token";

/** How long a session lives. Sessions do not slide: 30 days from sign-in, then out. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A signed-in user, plus the raw token the caller must be handed back. */
export interface AuthenticatedSession {
  user: UserDto;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
  ) {}

  async signup(request: SignupRequest): Promise<AuthenticatedSession> {
    if (await this.repository.findUserByEmail(request.email)) {
      throw new ConflictError("Email already registered");
    }

    const user = await this.repository.createUser({
      email: request.email,
      name: request.name,
      passwordHash: await this.passwords.hash(request.password),
    });

    return this.startSession(user);
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

  private async startSession(user: UserRow): Promise<AuthenticatedSession> {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

    return { user: toUserDto(user), token, expiresAt };
  }
}
