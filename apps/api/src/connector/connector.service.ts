import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Answer, Question } from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import { DefinitionsService } from "../definitions/definitions.service";
import { ProjectsService } from "../projects/projects.service";

/**
 * What a connector is told about the admin it serves.
 *
 * A connector holds no definition of its own and is given no SQL: it is handed
 * the published definition — the same payload Cloud resolves a request against,
 * validated on arrival by the same `validateDefinition` — and from then on a
 * descriptor is enough, because both ends are reading the same document. That
 * is the whole reason descriptors can replace statements (DECISIONS #064).
 *
 * It is also handed the project's action signing secret, once, when its session
 * opens. An `httpCall` action leaves from the connector because the endpoint it
 * calls may not be reachable from anywhere else, and a call that cannot be
 * signed is a call the customer's application is right to refuse. The secret is
 * the customer's own, it goes to the customer's own process, and it is held in
 * memory there for as long as the session lasts.
 *
 * The two questions are answered through the socket transport rather than over
 * HTTP, and this service registers itself with that transport rather than being
 * reached from it: the transport is infrastructure and knows nothing about what
 * a question means, which is what keeps the definitions feature able to
 * announce a publish through it without depending on this.
 */
@Injectable()
export class ConnectorService implements OnModuleInit {
  constructor(
    private readonly sockets: ConnectorSocketsService,
    private readonly definitions: DefinitionsService,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Registered in `onModuleInit`, which Nest runs for every module before any
   * module's `onApplicationBootstrap` — so the socket server cannot accept a
   * connector before there is something here to answer it.
   */
  onModuleInit(): void {
    this.sockets.answerQuestions((projectId, question) => this.answer(projectId, question));
  }

  private async answer(projectId: string, question: Question): Promise<Answer> {
    const definition = await this.publishedFor(projectId);

    if (question.kind === "pullDefinition") return { kind: "definition", definition };

    return {
      kind: "session",
      actionSecret: await this.projects.actionSecret(projectId),
      definition,
    };
  }

  /**
   * The version this project's admin is served out of, or null while nothing
   * has been published. A connector with nothing to serve is not a failure: it
   * is a project whose definition has not been made live yet, and it will be
   * told the moment one is.
   */
  private async publishedFor(projectId: string): Promise<{ version: number; payload: unknown } | null> {
    const principal: Principal = { kind: "connector", projectId };
    const published = await this.definitions.getPublished(principal, projectId);

    return published ? { version: published.version, payload: published.payload } : null;
  }
}
