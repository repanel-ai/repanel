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
  const config = app.get(ConfigService);
  // Two browsers reach this API, and both are on another origin by design
  // (DECISIONS #025). Development proxies them through one origin and never
  // asks; a deployment does, and the request carries the session cookie — so
  // the allowance names the two surfaces this deployment was configured with
  // rather than standing open.
  app.enableCors({ origin: [config.consoleUrl, config.runtimeUrl], credentials: true });
  app.useBodyParser("json", { limit: BODY_LIMIT });
  // Express 5 parses a query string flat, so `filter[status]=active` would
  // arrive as one key with brackets in its name. The runtime's filters are
  // nested by design, and this is the parser express ships for reading them.
  app.set("query parser", "extended");
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();
  await app.listen(config.port);
}

void bootstrap();
