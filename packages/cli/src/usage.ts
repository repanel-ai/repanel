import { SCHEMA_VERSION } from "@repanel/contracts";
import { DEFINITION_DIRECTORY } from "./assemble/assemble.js";
import { PROJECT_FILE } from "./cloud/project-file.js";
import { TOKEN_VARIABLE } from "./commands/connect.js";

/** An option a command takes, said once and spent twice: the help, and the gate. */
interface CommandOption {
  /** The long name, as `parseArgs` knows it. */
  readonly name: string;
  /** The line `--help` prints for it. */
  readonly help: string;
}

interface CommandDescription {
  /** One line, as the command list shows it. */
  readonly summary: string;
  /** What `repanel <command> --help` says, one line per element. */
  readonly details: readonly string[];
  /** The options it takes, if it takes any. The synopsis says `[options]`
   *  exactly when this is here, and every other command refuses them. */
  readonly options?: readonly CommandOption[];
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
      { name: "port", help: "  --port <number>        listen on this port (default 5170)" },
      {
        name: "database-url",
        help: "  --database-url <dsn>   use this database instead of the one in .env",
      },
      { name: "yes", help: "  -y, --yes              accept the database found in .env without asking" },
    ],
  },
  link: {
    summary: "connect this repository to a RePanel project",
    details: [
      "Signs this machine in through your browser, chooses a project, and points",
      "it at the database this application already reads.",
      "",
      "The connection string is read from your environment — DATABASE_URL, or",
      "`.env.local`, or `.env` — shown to you with its password taken out, and",
      "sent to RePanel only once you have said yes. It is never written down and",
      "never printed, and it cannot be given as an option: a connection string on",
      "a command line is a connection string in your shell history.",
      "",
      `Writes ${PROJECT_FILE}, which holds the project key and nothing else.`,
      "Commit it — it is how `repanel deploy` knows where this repository goes.",
    ],
    options: [
      { name: "project", help: "  --project <key>        link to this project instead of choosing one" },
    ],
  },
  connect: {
    summary: "serve this project's admin from beside your own database",
    details: [
      "Runs the connector: RePanel's engine, on this machine, reading the",
      "database this machine can already reach. The connection string stays",
      "here — RePanel never receives one — and this process dials out, so",
      "nothing about it is reachable from the internet.",
      "",
      "What comes down the channel is what to read: which resource, which",
      "record, which action, out of the definition you published. The SQL is",
      "written here, by the same engine the hosted runtime uses. Nothing is",
      "written to disk: the definition and the signing secret arrive over the",
      "channel and live in memory, and stopping this leaves nothing behind.",
      "",
      "Mint the token on your project's Connection page in the RePanel console.",
      `It can also be given as ${TOKEN_VARIABLE} in this machine's environment,`,
      "which is the better habit — a token on a command line is a token in your",
      "shell history.",
      "",
      "The connection string is read from your environment — DATABASE_URL, or",
      "`.env.local`, or `.env` — exactly as `repanel dev` reads it.",
    ],
    options: [
      { name: "token", help: "  --token <rpc_…>        the connector token for this project" },
      {
        name: "database-url",
        help: "  --database-url <dsn>   use this database instead of the one in .env",
      },
    ],
  },
  deploy: {
    summary: "submit the assembled definition to the linked project",
    details: [
      `Assembles ${DEFINITION_DIRECTORY}/ and submits it to the project ${PROJECT_FILE}`,
      "names, over the session `repanel link` signed this machine in with.",
      "",
      "The submission replaces the whole definition. A definition that does not",
      "validate is stored all the same and comes back as a work list, reported in",
      "the file that holds each problem exactly as `repanel validate` reports it;",
      "one that does validate answers with the address of the admin it describes.",
    ],
    options: [
      { name: "project", help: "  --project <key>        submit to this project instead of the linked one" },
    ],
  },
} as const satisfies Record<string, CommandDescription>;

export type Command = keyof typeof COMMANDS;

export function isCommand(name: string): name is Command {
  return Object.hasOwn(COMMANDS, name);
}

/** Which commands take an option, for the help and for refusing it elsewhere. */
export function commandsTaking(option: string): Command[] {
  return commands().filter(([, command]) =>
    (command.options ?? []).some((taken) => taken.name === option),
  ).map(([name]) => name);
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
    ...commands().map(([name, command]) => `  ${name.padEnd(width)}  ${command.summary}`),
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
    ...(options ? ["", "Options", ...options.map((option) => option.help)] : []),
  ];
}

function commands(): [Command, CommandDescription][] {
  return Object.entries(COMMANDS) as [Command, CommandDescription][];
}
