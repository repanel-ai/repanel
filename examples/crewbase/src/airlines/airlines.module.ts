import { Module } from "@nestjs/common";
import { AirlinesRepository } from "./airlines.repository";
import { AirlinesService } from "./airlines.service";

@Module({
  providers: [AirlinesService, AirlinesRepository],
  exports: [AirlinesService],
})
export class AirlinesModule {}
