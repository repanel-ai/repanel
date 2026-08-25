/**
 * The definition's problems, over the admin they broke.
 *
 * This file is served by `repanel dev` and injected into the page; it is not
 * part of the runtime bundle. It never touches the app it sits over: the admin
 * underneath keeps its state, keeps answering, and stays usable while the
 * overlay is up — the last good render is still the render.
 *
 * Everything is in a shadow root so the app's stylesheet cannot reach in and
 * this cannot reach out, and the host box is only as big as the panel, so
 * nothing outside it intercepts a click.
 */

const ENDPOINT = "/@repanel-dev/events";

const STYLE = `
  :host { all: initial; }
  .panel {
    position: fixed; bottom: 16px; left: 16px; z-index: 2147483647;
    width: min(680px, calc(100vw - 32px)); max-height: min(60vh, 560px);
    display: flex; flex-direction: column; overflow: hidden;
    border-radius: 10px; border: 1px solid #3d2b2b; background: #1b1416;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px; line-height: 1.5; color: #f2e9e9;
  }
  header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; border-bottom: 1px solid #3d2b2b; background: #241a1c;
  }
  .count { font-weight: 600; }
  .note { color: #b9a5a7; font-weight: 400; }
  .spacer { flex: 1; }
  button {
    font: inherit; color: #b9a5a7; background: none; border: 0;
    cursor: pointer; padding: 2px 6px; border-radius: 5px;
  }
  button:hover { color: #f2e9e9; background: #3d2b2b; }
  ol { margin: 0; padding: 4px 0; list-style: none; overflow: auto; }
  li { padding: 10px 12px; border-top: 1px solid #2c2022; }
  li:first-child { border-top: 0; }
  .where {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 12px; color: #ff9f8f; word-break: break-all;
  }
  .message { margin-top: 3px; }
  .expected, .hint { margin-top: 3px; color: #b9a5a7; }
  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 12px; color: #f2e9e9;
  }
`;

const host = document.createElement("div");
host.dataset.repanelDev = "problems";
const root = host.attachShadow({ mode: "closed" });
const style = document.createElement("style");
style.textContent = STYLE;
root.append(style);
document.body.append(host);

/** Dismissed until the next failure, so a fixed screen is not covered by news of it. */
let dismissed = false;

const source = new EventSource(ENDPOINT);
source.addEventListener("message", (event) => {
  let update;
  try {
    update = JSON.parse(event.data);
  } catch {
    return;
  }
  if (update.type === "reload") {
    location.reload();
    return;
  }
  if (update.type === "problems") {
    dismissed = false;
    render(update.problems ?? []);
  }
});

function render(problems) {
  const existing = root.querySelector(".panel");
  if (existing) existing.remove();
  if (problems.length === 0 || dismissed) return;

  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("header");
  const count = document.createElement("span");
  count.className = "count";
  count.textContent = `${problems.length} problem${problems.length === 1 ? "" : "s"} in repanel/`;
  const note = document.createElement("span");
  note.className = "note";
  note.textContent = "— still showing the last definition that validated";
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Dismiss";
  close.setAttribute("aria-label", "Dismiss until the next problem");
  close.addEventListener("click", () => {
    dismissed = true;
    render([]);
  });
  header.append(count, note, spacer, close);

  const list = document.createElement("ol");
  for (const problem of problems) list.append(item(problem));

  panel.append(header, list);
  root.append(panel);
}

function item(problem) {
  const entry = document.createElement("li");

  const where = document.createElement("div");
  where.className = "where";
  where.textContent = problem.path ? `${problem.file} · ${problem.path}` : problem.file;

  const message = document.createElement("div");
  message.className = "message";
  message.append(...ticked(problem.message));

  entry.append(where, message);

  if (problem.expected) {
    const expected = document.createElement("div");
    expected.className = "expected";
    expected.append("expected: ", ...ticked(problem.expected));
    entry.append(expected);
  }

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.append("hint: ", ...ticked(problem.hint));
  entry.append(hint);

  return entry;
}

/**
 * The validator writes `\`like this\``, which is the only markup its messages
 * carry. Built as nodes rather than as HTML: every one of these strings quotes
 * something out of the customer's own definition.
 */
function ticked(text) {
  return String(text)
    .split("`")
    .map((part, index) => {
      if (index % 2 === 0) return document.createTextNode(part);
      const code = document.createElement("code");
      code.textContent = part;
      return code;
    });
}
