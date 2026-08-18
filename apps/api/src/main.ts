import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { ZodValidationPipe } from "./validation/zod-validation.pipe";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).port);
}

void bootstrap();
