import { assembleDefinition } from "../assemble/assemble.js";
import { AssemblyError } from "../assemble/errors.js";
import { addressesFrom } from "../cloud/addresses.js";
import { Cloud } from "../cloud/api.js";
import { CloudError } from "../cloud/errors.js";
import { PROJECT_FILE, readProjectKey } from "../cloud/project-file.js";
import { readSession } from "../cloud/session.js";
import type { CommandResult } from "../command-result.js";
import { problemsFrom, reportProblems } from "../problems.js";

export interface DeployOptions {
  readonly env: NodeJS.ProcessEnv;
  /** The operator's home directory, where the CLI keeps its own session. */
  readonly home: string;
  /** The project to submit to, when the operator named one by key. */
  readonly project?: string;
}

/**
 * Submits the definition in this repository to the project it is linked to.
 *
 * The same submission an agent makes through MCP, made instead by the person
 * whose account it is. What comes back is a verdict rather than a failure — an
 * invalid definition is stored too — so a refusal is reported the way
 * `repanel validate` reports one: in the file that holds the problem, with the
 * path inside it and a fix.
 */
export async function deploy(projectRoot: string, options: DeployOptions): Promise<CommandResult> {
  try {
    return await submit(projectRoot, options);
  } catch (error) {
    if (error instanceof CloudError) {
      return { exitCode: 1, lines: [error.message, `  hint: ${error.hint}`] };
    }
    if (error instanceof AssemblyError) {
      return { exitCode: 1, lines: [error.message, `  hint: ${error.hint}`] };
    }
    throw error;
  }
}

async function submit(projectRoot: string, options: DeployOptions): Promise<CommandResult> {
  const addresses = addressesFrom(options.env);

  const token = await readSession(options.home, addresses.api);
  if (token === undefined) {
    throw new CloudError(
      "This machine is not signed in to RePanel.",
      "Run `repanel link`: it signs in through your browser and connects the database.",
    );
  }
  const cloud = new Cloud(addresses.api, token);

  const key = options.project ?? (await readProjectKey(projectRoot));
  if (key === undefined) {
    throw new CloudError(
      `This repository is not linked to a project: \`${PROJECT_FILE}\` is missing.`,
      "Run `repanel link` to choose one, or name it with `repanel deploy --project <key>`.",
    );
  }

  const project = (await cloud.projects()).find((candidate) => candidate.key === key);
  if (!project) {
    throw new CloudError(
      `No project with the key \`${key}\` in this account.`,
      `Run \`repanel link\` to choose the project this repository submits to; it rewrites \`${PROJECT_FILE}\`.`,
    );
  }

  // Assembled here and judged there: the composed object is what a submission
  // is, and the files it came from are what a problem has to be reported in.
  const assembled = await assembleDefinition(projectRoot);
  const verdict = await cloud.submit(project.id, assembled.definition);

  if (!verdict.valid) {
    return {
      exitCode: 1,
      lines: reportProblems(problemsFrom(verdict.errors, assembled.sources)),
    };
  }

  return {
    exitCode: 0,
    lines: ["", `Submitted to ${project.name}.`, "", `  Admin   ${verdict.adminUrl}`, ""],
  };
}
