import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AirlinesRepository, type AirlineApproval } from "./airlines.repository";

/**
 * What an airline may do in Crewbase, and the rules about getting there.
 *
 * The rule lives here rather than in the admin API's controller — and could not
 * live in RePanel's definition at all. An admin that flipped the column would
 * be able to approve an airline that was already rejected; the application is
 * the only place that knows why that is wrong.
 */
@Injectable()
export class AirlinesService {
  constructor(private readonly airlines: AirlinesRepository) {}

  /**
   * Approves a pending airline. An airline that is already approved or has been
   * rejected is a conflict, not a no-op: the operator asked for something the
   * record cannot do, and telling them so is the whole value of the endpoint.
   */
  async approve(id: string): Promise<AirlineApproval> {
    const approved = await this.airlines.approveIfPending(id);
    if (approved) return approved;

    // Only reached when nothing was approved, so this read explains a failure
    // rather than deciding one.
    const airline = await this.airlines.findApproval(id);
    if (!airline) throw new NotFoundException("No such airline.");

    throw new ConflictException(
      `This airline is ${airline.approvalStatus}; only a pending airline can be approved.`,
    );
  }
}
