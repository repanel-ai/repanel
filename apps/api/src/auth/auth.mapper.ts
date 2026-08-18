import type { UserDto } from "@repanel/contracts";
import type { UserRow } from "./auth.repository";

/** The only way a user row leaves the API. The password hash stays behind. */
export function toUserDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, name: user.name };
}
