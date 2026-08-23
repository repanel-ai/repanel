import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { airlines, type approvalStatus } from "../db/schema";

export type ApprovalStatus = (typeof approvalStatus.enumValues)[number];

/** As little of an airline as approving one needs to say anything about. */
export interface AirlineApproval {
  id: string;
  approvalStatus: ApprovalStatus;
}

const approvalColumns = { id: airlines.id, approvalStatus: airlines.approvalStatus };

/** Every read and write of the `airlines` table. */
@Injectable()
export class AirlinesRepository {
  constructor(private readonly db: DbService) {}

  /**
   * Approves an airline only if it is still pending, and says whether it did.
   *
   * The rule is in the `WHERE` clause rather than in a check before the update
   * because two approvals arriving at once would both pass a check and the
   * second would silently win. Postgres decides, once.
   */
  async approveIfPending(id: string): Promise<AirlineApproval | undefined> {
    const [approved] = await this.db.db
      .update(airlines)
      .set({ approvalStatus: "approved" })
      .where(and(eq(airlines.id, id), eq(airlines.approvalStatus, "pending")))
      .returning(approvalColumns);

    return approved;
  }

  async findApproval(id: string): Promise<AirlineApproval | undefined> {
    const [airline] = await this.db.db
      .select(approvalColumns)
      .from(airlines)
      .where(eq(airlines.id, id))
      .limit(1);

    return airline;
  }
}
