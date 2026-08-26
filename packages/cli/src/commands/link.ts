import path from "node:path";
import type { ProjectDto } from "@repanel/contracts";
import { addressesFrom } from "../cloud/addresses.js";
import type { Cloud } from "../cloud/api.js";
import { CloudError } from "../cloud/errors.js";
import { PROJECT_FILE, writeProjectKey } from "../cloud/project-file.js";
import { signIn } from "../cloud/sign-in.js";
import type { CommandResult } from "../command-result.js";
import { describeDatabase, findDatabaseUrl } from "../database-url.js";
import { count } from "../problems.js";
import type { Terminal } from "../terminal.js";

export interface LinkOptions {
  readonly env: NodeJS.ProcessEnv;
  /** The operator's home directory, where the CLI keeps its own session. */
  readonly home: string;
  /** The project to link, when the operator named one by key. */
  readonly project?: string;
}

/**
 * Marries this repository to a RePanel project, and that project to the
 * database this application already reads.
 *
 * The connection string is the whole reason this is a command rather than a
 * page. It is read from the environment the application itself is configured
 * with, shown to the human with its password taken out, confirmed by them, and
 * sent straight to the API over their own session. It is never written down,
 * never printed, never taken as an argument, and never passes through an agent
 * — which is what makes this command safe for an agent to *run* (DECISIONS
 * #049).
 */
export async function link(
  projectRoot: string,
  options: LinkOptions,
  terminal: Terminal,
): Promise<CommandResult> {
  try {
    return await connect(projectRoot, options, terminal);
  } catch (error) {
    if (!(error instanceof CloudError)) throw error;
    return { exitCode: 1, lines: [error.message, `  hint: ${error.hint}`] };
  }
}

async function connect(
  projectRoot: string,
  options: LinkOptions,
  terminal: Terminal,
): Promise<CommandResult> {
  const { ask, confirm } = terminal;
  if (!ask || !confirm) {
    throw new CloudError(
      "Nobody to ask: `repanel link` chooses a project and confirms a database, and this is not an interactive terminal.",
      "Run it from a terminal. Nothing here can be answered on this command's behalf: the database it sends is the one thing a human has to see first.",
    );
  }

  const addresses = addressesFrom(options.env);
  const { cloud, user } = await signIn(addresses, options.home, terminal);
  terminal.write(`Signed in as ${user.email}.`);

  const project = await chooseProject(cloud, options.project, projectRoot, ask, terminal);

  const database = await findDatabaseUrl(projectRoot, undefined, options.env);
  if (!database) {
    throw new CloudError(
      "No DATABASE_URL found: it is not set in your environment and neither `.env.local` nor `.env` declares it.",
      "Add `DATABASE_URL=` to this repository's `.env`, or export it, and run `repanel link` again. It is deliberately not an option: a connection string on a command line is a connection string in your shell history.",
    );
  }

  terminal.write("");
  terminal.write(`Found DATABASE_URL in ${database.origin}`);
  if (!(await confirm(`Connect ${describeDatabase(database.url)} to ${project.name}? [Y/n] `))) {
    throw new CloudError(
      "Stopped: nothing was sent to RePanel.",
      "Run `repanel link` again when the database in your environment is the one this project should read.",
    );
  }

  await cloud.connect(project.id, database.url);
  await writeProjectKey(projectRoot, project.key);

  return {
    exitCode: 0,
    lines: [
      "",
      // The same words the confirmation used, because it is the same database:
      // an acknowledgement that renames what was just agreed to is a question
      // the operator now has to answer twice.
      `Connected ${describeDatabase(database.url)} to ${project.name}.`,
      "  It is stored encrypted, and RePanel never shows it again.",
      `Wrote ${PROJECT_FILE}, which holds the project key and nothing else — commit it.`,
      "",
      "Run `repanel deploy` to submit the definition.",
      "",
    ],
  };
}

/**
 * Which project this repository belongs to. Named outright, chosen from the
 * account's own, or created — and never guessed: submitting a definition to
 * the wrong project is not something an apology fixes.
 */
async function chooseProject(
  cloud: Cloud,
  named: string | undefined,
  projectRoot: string,
  ask: (question: string) => Promise<string>,
  terminal: Terminal,
): Promise<ProjectDto> {
  const projects = await cloud.projects();

  if (named !== undefined) {
    const found = projects.find((project) => project.key === named);
    if (!found) {
      throw new CloudError(
        `No project with the key \`${named}\` that this account owns.`,
        `Run \`repanel link\` without \`--project\` to choose from the ${count(projects.length, "project")} this account has, or to create one.`,
      );
    }
    return found;
  }

  if (projects.length === 0) return create(cloud, projectRoot, ask);

  const width = Math.max(...projects.map((project) => project.name.length));
  const newProject = projects.length + 1;
  terminal.write("");
  terminal.write("Projects");
  for (const [index, project] of projects.entries()) {
    terminal.write(`  ${index + 1}  ${project.name.padEnd(width)}  ${project.key}`);
  }
  terminal.write(`  ${newProject}  Create a new project`);
  terminal.write("");

  const answer = (await ask("Which project? [1] ")).trim();
  const chosen = answer === "" ? 1 : Number(answer);
  if (!Number.isInteger(chosen) || chosen < 1 || chosen > newProject) {
    throw new CloudError(
      `\`${answer}\` is not one of the choices.`,
      `Run \`repanel link\` again and answer with a number between 1 and ${newProject}.`,
    );
  }

  return chosen === newProject ? create(cloud, projectRoot, ask) : (projects[chosen - 1] as ProjectDto);
}

/** A new project, named after the repository unless the operator says otherwise. */
async function create(
  cloud: Cloud,
  projectRoot: string,
  ask: (question: string) => Promise<string>,
): Promise<ProjectDto> {
  const suggested = path.basename(projectRoot);
  const answer = (await ask(`Name the new project [${suggested}]: `)).trim();
  return cloud.createProject(answer === "" ? suggested : answer);
}
