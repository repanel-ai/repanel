import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { MAX_PAYLOAD_BYTES } from "./definitions/definition-size";
import { ZodValidationPipe } from "./validation/zod-validation.pipe";

/**
 * Room for the largest definition a submission may carry, plus the JSON-RPC
 * envelope around it. Sized from the definition limit so the two cannot drift:
 * an oversized definition is refused by the guard that can explain the refusal,
 * never by a body parser that cannot.
 */
const BODY_LIMIT = MAX_PAYLOAD_BYTES + 64 * 1024;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: BODY_LIMIT });
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).port);
}

void bootstrap();
