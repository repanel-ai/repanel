import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AirlinesModule } from "../airlines/airlines.module";
import { AirlinesAdminController } from "./airlines-admin.controller";
import { RepanelSignatureMiddleware } from "./repanel-signature.middleware";

/**
 * SkyScout's admin API: the one module RePanel's actions may call, mounted
 * under `/repanel` behind one verification middleware (RePanel DECISIONS #013).
 *
 * Everything reachable through it is a route the application already knows how
 * to perform — the admin names which record and which action, never what the
 * action does. New operational endpoints join this module; nothing joins it
 * without going through the signature check, which is why the middleware is
 * bound to the prefix rather than to a list of routes.
 */
@Module({
  imports: [AirlinesModule],
  controllers: [AirlinesAdminController],
})
export class RepanelModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RepanelSignatureMiddleware)
      .forRoutes({ path: "repanel/*path", method: RequestMethod.ALL });
  }
}
