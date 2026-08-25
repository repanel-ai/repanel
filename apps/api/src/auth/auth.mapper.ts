import type { CliSessionDto, UserDto } from "@repanel/contracts";
import type { MintedSession } from "./auth.service";
import type { UserRow } from "./auth.repository";

/** The only way a user row leaves the API. The password hash stays behind. */
export function toUserDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * The one response that carries a session token. When it stops working stays
 * behind: the CLI finds that out by being refused, which is the only answer it
 * could act on anyway.
 */
export function toCliSessionDto(session: MintedSession): CliSessionDto {
  return { token: session.token };
}
