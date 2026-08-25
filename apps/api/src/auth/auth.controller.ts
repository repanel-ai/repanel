import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  loginRequestSchema,
  signupRequestSchema,
  type CliSessionDto,
  type UserDto,
} from "@repanel/contracts";
import type { Request, Response } from "express";
import { ConfigService } from "../config/config.service";
import { zodDto } from "../validation/zod-dto";
import { toCliSessionDto } from "./auth.mapper";
import { AuthService, type AuthenticatedSession } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { SESSION_COOKIE, sessionCookieFlags, sessionTokenFrom } from "./session-cookie";
import { SessionAuthGuard } from "./session-auth.guard";

/** Declared parameter types, so the global validation pipe knows what to parse. */
class SignupDto extends zodDto(signupRequestSchema) {}
class LoginDto extends zodDto(loginRequestSchema) {}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("signup")
  async signup(
    @Body() body: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    return this.withSessionCookie(await this.auth.signup(body), response);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    return this.withSessionCookie(await this.auth.login(body), response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(sessionTokenFrom(request));
    response.clearCookie(SESSION_COOKIE, sessionCookieFlags(this.config.nodeEnv));
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: UserDto): UserDto {
    return user;
  }

  /**
   * A session for the `repanel` CLI on this account's machine, asked for by the
   * browser session that authorized it. The token is in the body because the
   * caller is not the browser: the console reads it and hands it straight to
   * the loopback address the CLI is listening on, and nothing keeps a copy.
   */
  @Post("cli")
  @UseGuards(SessionAuthGuard)
  async cli(@CurrentUser() user: UserDto): Promise<CliSessionDto> {
    return toCliSessionDto(await this.auth.mintSession(user.id));
  }

  /** Sends the session back as a cookie; the body carries only the user. */
  private withSessionCookie(session: AuthenticatedSession, response: Response): UserDto {
    response.cookie(SESSION_COOKIE, session.token, {
      ...sessionCookieFlags(this.config.nodeEnv),
      expires: session.expiresAt,
    });
    return session.user;
  }
}
