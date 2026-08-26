import type { PersonDto, UserDto } from "@repanel/contracts";
import type { ProjectMemberRow } from "./projects.repository";

/**
 * The only way a membership leaves the API: the role from the row that grants
 * it, the person from the account it names. Neither half is complete alone —
 * a membership has no name and an account has no role on this project.
 */
export function toPersonDto(member: ProjectMemberRow, account: UserDto): PersonDto {
  return {
    userId: account.id,
    email: account.email,
    name: account.name,
    role: member.role,
    addedAt: member.createdAt.toISOString(),
  };
}
