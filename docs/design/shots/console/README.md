# Task 014 · the control plane, walked end to end

The console (`apps/web`) doing the one job it exists for: taking a developer
from nothing to a rendered admin without a single `curl`. Every shot below is
the same run, in order, against a live stack — RePanel's API on 3001, the
console on 5173, the runtime on 5174, and Crewbase's own Postgres on 5433
(`examples/crewbase`, ~200 seeded rows).

1280×900 at 2×, light. The console has no theme toggle: it borrows the runtime's
tokens at lower density and nothing else (DESIGN.md §6).

| # | shot | what it shows |
|---|---|---|
| 1 | `01-projects-empty.png` | The console with nothing in it yet. |
| 2 | `02-create-project.png` | The create dialog. A name is the whole of it — the key is minted. |
| 3 | `03-project-fresh.png` | A new project: no connection, no tokens, no definition. The three sections in the order they have to be done. |
| 4 | `04-connection-tested.png` | The DSN saved and the database asked. The host and database name are what comes back; the connection string never does. |
| 5 | `05-connection-refused.png` | The same test against a wrong password: one of 007's four sanitized categories, said in a sentence. The driver's own words never reach the screen. |
| 6 | `06-token-shown-once.png` | A minted token, on screen for the only time it will ever exist, with the setup snippets written out around it. |
| 7 | `07-action-secret.png` | The action-signing secret, fetched only because somebody asked for it. |
| 8 | `08-projects-list.png` | Two projects, each wearing where its definition stands. |
| 9 | `09-definition-invalid.png` | The agent's first submission, refused: path, problem and the hint the validator wrote (#008's payoff, in front of a human). |
| 10 | `10-definition-valid.png` | The repaired submission, and the way through to the admin. |
| 11 | `11-admin-airlines.png` | `Open admin` followed: the runtime, on its own origin, rendering Crewbase. |
| 12 | `12-admin-candidates.png` | The hostile resource. `profile` is hidden, `deleted_at` is not a column, `status` is a badge nobody can type into, and the airline relation resolves to a name. |

## The loop, as it was actually run

1. Signed in as `ada@example.com`; the console had no projects.
2. Created **Crewbase** from the dialog; landed on its page (shot 3).
3. Pasted `postgres://crewbase:crewbase@localhost:5433/crewbase`, saved, tested
   — answered (shot 4). Saved a wrong-password DSN and tested again to see the
   refusal (shot 5), then put the working one back.
4. Minted a token labelled *Claude Code on my laptop* (shot 6), and revealed the
   action secret (shot 7).
5. Connected an MCP client to `http://localhost:3001/mcp` with that token and
   submitted a definition of all five Crewbase tables. The first submission
   named a resource that did not exist and put `password_hash` in a table —
   the console showed both, with hints, without being reloaded (shot 9).
6. Submitted the repaired definition; the card flipped to valid on its own poll
   (shot 10).
7. Followed **Open admin** to `http://localhost:5174/a/crewbase-po72ft` (shots
   11 and 12).

The definition submitted here is not checked in: writing one against Crewbase
with a fresh agent is checkpoint D's job (ROADMAP), and this run only had to
prove the console's half of it.
