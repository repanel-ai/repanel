import { SCHEMA_VERSION } from "@repanel/contracts";
import { DEFINITION_DIRECTORY } from "./assemble/assemble.js";

interface CommandDescription {
  /** One line, as the command list shows it. */
  readonly summary: string;
  /** What `repanel <command> --help` says, one line per element. */
  readonly details: readonly string[];
  /** The options it takes, if it takes any. One fact, spent twice: the
   *  synopsis says `[options]` exactly when this is here. */
  readonly options?: readonly string[];
}

/** Every command, in the order the help lists them. */
export const COMMANDS = {
  validate: {
    summary: `assemble ${DEFINITION_DIRECTORY}/ and check it against the definition schema`,
    details: [
      `Assembles the definition in ${DEFINITION_DIRECTORY}/ and checks it against definition`,
      `schema ${SCHEMA_VERSION} — the same check a submission makes.`,
      "",
      "Every problem is reported in the file that holds it, with the path inside",
      "that file, what was expected, and a suggested fix. Exits nonzero when the",
      "definition is not valid.",
    ],
  },
  dev: {
    summary: "run the admin locally against your own database",
    details: [
      "Serves the real admin on your machine, reading your own database. No",
      "RePanel account and no RePanel network call: the definition comes off the",
      "disk, the records come from the database you confirm, and the only other",
      "address reached is one your own actions declare.",
      "",
      `Edits to ${DEFINITION_DIRECTORY}/ are picked up as you make them. A definition that`,
      "does not validate is shown as an overlay in the browser, in the same",
      "path-and-hint form `repanel validate` prints, over the admin drawn from the",
      "last definition that did — so the screen you were on stays where it was.",
    ],
    options: [
      "  --port <number>        listen on this port (default 5170)",
      "  --database-url <dsn>   use this database instead of the one in .env",
      "  -y, --yes              accept the database found in .env without asking",
    ],
  },
  link: {
    summary: "connect this repository to a RePanel project (coming next)",
    details: ["Signs in, picks a project, and connects its database."],
  },
  deploy: {
    summary: "submit the assembled definition (coming next)",
    details: ["Assembles the definition and submits it to the linked project."],
  },
} as const satisfies Record<string, CommandDescription>;

export type Command = keyof typeof COMMANDS;

export function isCommand(name: string): name is Command {
  return Object.hasOwn(COMMANDS, name);
}

export function usage(): string[] {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  return [
    "repanel — RePanel's command line",
    "",
    "Usage",
    "  repanel <command>",
    "",
    "Commands",
    ...Object.entries(COMMANDS).map(
      ([name, command]) => `  ${name.padEnd(width)}  ${command.summary}`,
    ),
    "",
    "Options",
    "  -h, --help  show this help, or a command's own help",
    "",
    `The definition lives in ${DEFINITION_DIRECTORY}/ at the root of your repository: either`,
    "definition.json, or app.json with one file per resource under resources/.",
  ];
}

export function commandHelp(command: Command): string[] {
  const { details, options } = COMMANDS[command] as CommandDescription;
  return [
    "Usage",
    `  repanel ${command}${options ? " [options]" : ""}`,
    "",
    ...details,
    ...(options ? ["", "Options", ...options] : []),
  ];
}
