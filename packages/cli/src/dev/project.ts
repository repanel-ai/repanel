import { validateDefinition, type Definition } from "@repanel/contracts";
import { assembleDefinition } from "../assemble/assemble.js";
import { AssemblyError } from "../assemble/errors.js";
import { problemFromAssembly, problemsFrom, type Problem } from "../problems.js";

/** What the browser is told when the definition on disk has been read again. */
export type DefinitionEvent =
  | { readonly type: "reload" }
  | { readonly type: "problems"; readonly problems: readonly Problem[] };

/** One read of the definition directory: a definition, or what is wrong with it. */
export interface Reading {
  readonly definition?: Definition;
  readonly problems: readonly Problem[];
}

/** Assembles the definition and checks it, saying nothing a submission would not. */
export async function readDefinition(projectRoot: string): Promise<Reading> {
  let assembled;
  try {
    assembled = await assembleDefinition(projectRoot);
  } catch (error) {
    if (!(error instanceof AssemblyError)) throw error;
    return { problems: [problemFromAssembly(error)] };
  }

  const result = validateDefinition(assembled.definition);
  if (!result.valid) return { problems: problemsFrom(result.errors, assembled.sources) };

  return { definition: result.definition, problems: [] };
}

/**
 * The definition the local admin is being served from, and what is wrong with
 * the one on disk.
 *
 * The two are separate on purpose. A broken edit never replaces what is being
 * served, so the admin an operator is working in stays exactly as it was —
 * still drawn, still answering, still interactive — while the overlay says what
 * went wrong. A definition is only ever swapped for one that validated.
 */
export class WatchedDefinition {
  private problems: readonly Problem[] = [];
  private readonly listeners = new Set<(event: DefinitionEvent) => void>();
  /**
   * The read in flight, so reads run one after another. A burst of saves that
   * outruns one read would otherwise let an older answer land last, and the
   * admin would serve a definition nobody has on disk until the next save.
   */
  private reading: Promise<DefinitionEvent> = Promise.resolve({ type: "reload" });

  constructor(
    private readonly projectRoot: string,
    private definition: Definition,
  ) {}

  /** The last definition that validated. There is always one: dev will not start without it. */
  get current(): Definition {
    return this.definition;
  }

  /** What is wrong with the definition on disk right now, or nothing. */
  get currentProblems(): readonly Problem[] {
    return this.problems;
  }

  subscribe(listener: (event: DefinitionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Reads the directory again and says what changed. */
  reread(): Promise<DefinitionEvent> {
    this.reading = this.reading.then(
      () => this.read(),
      () => this.read(),
    );
    return this.reading;
  }

  private async read(): Promise<DefinitionEvent> {
    const reading = await readDefinition(this.projectRoot);

    if (reading.definition) {
      this.definition = reading.definition;
      this.problems = [];
      return this.announce({ type: "reload" });
    }

    this.problems = reading.problems;
    return this.announce({ type: "problems", problems: this.problems });
  }

  private announce(event: DefinitionEvent): DefinitionEvent {
    for (const listener of this.listeners) listener(event);
    return event;
  }
}
