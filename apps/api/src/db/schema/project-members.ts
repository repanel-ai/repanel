import { PROJECT_ROLES } from "@repanel/contracts";
import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";

/**
 * Who may reach a project, and as what. This table is the whole of the
 * authorization model: `projects.user_id` says who made a project and takes it
 * with them, but every question of the form "may this person do this here" is
 * answered from a row in here (DECISIONS #062).
 *
 * An owner row is written with the project itself, in the same transaction, so
 * a project without anyone who can reach it is a state the code cannot express.
 *
 * Membership is per project rather than per account: the same person owns one
 * project and operates another, and there is no such thing as an "operator
 * account". Removing the row is the whole of revoking access — the check runs
 * on every request, so it takes effect on the next one.
 */
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: PROJECT_ROLES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One person holds one role on one project. The constraint is what makes
  // adding somebody twice a refusal rather than a second, contradictory row.
  (table) => [unique("project_members_project_user_key").on(table.projectId, table.userId)],
);
