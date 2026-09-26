import { projectUrlKind } from "@oclaunch/shared";

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function httpsHref(value: unknown): string | null {
  const raw = String(value ?? "");
  if (projectUrlKind(raw) !== "https") return null;
  return escapeHtml(raw);
}

export function renderPassportHtml(input: {
  project: Record<string, unknown>;
  releases: Array<Record<string, unknown>>;
  brandVersion: number | null;
  origin: string;
}): string {
  const name = escapeHtml(String(input.project.name ?? ""));
  const purpose = escapeHtml(String(input.project.purpose ?? ""));
  const audience = escapeHtml(String(input.project.audience ?? ""));
  const slug = escapeHtml(String(input.project.slug ?? ""));
  const liveHref = httpsHref(input.project.live_url);
  const live = liveHref ? `<p><a href="${liveHref}">Open the app</a></p>` : "";
  const releases = input.releases
    .map(
      (r) =>
        `<li><strong>${escapeHtml(String(r.label))}</strong> — ${escapeHtml(String(r.captured_at))}</li>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${name} · OCLaunch</title>
  <meta name="description" content="${purpose}" />
  <meta property="og:title" content="${name} on OCLaunch" />
  <meta property="og:description" content="${purpose}" />
  <meta property="og:url" content="${escapeHtml(input.origin)}/p/${slug}" />
  <link rel="icon" href="/favicon.svg" />
  <style>
    :root { --ink:#17252B; --canvas:#FAF8F5; --action:#C2410C; --muted:#59676D; --border:#DFE4E2; }
    body { margin:0; font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; background:var(--canvas); color:var(--ink); }
    main { max-width:720px; margin:0 auto; padding:48px 20px; }
    a { color:var(--action); }
    .muted { color:var(--muted); }
    ul { padding-left:1.2rem; }
  </style>
</head>
<body>
  <main>
    <p class="muted">Public page</p>
    <h1>${name}</h1>
    <p>${purpose}</p>
    <p class="muted">Who it is for: ${audience}</p>
    ${live}
    <h2>Versions</h2>
    <ul>${releases || "<li class='muted'>No public versions yet.</li>"}</ul>
    <p><a href="/">OCLaunch</a> · A community project by Orangecloud</p>
  </main>
</body>
</html>`;
}

const PLAIN_STATE: Record<string, string> = {
  verified: "Checked",
  observed: "Noted",
  triaged: "Reviewed",
  accepted: "Accepted",
  needs_evidence: "Needs more detail",
  dismissed: "Skipped",
  reopened: "Came back",
  implemented: "Marked live",
  verification_pending: "Waiting to be checked",
};

const PLAIN_SOURCE: Record<string, string> = {
  human_observation: "From a person",
  deterministic_check: "Automatic check",
  model_suggestion: "Suggestion",
  browser_observation: "Automatic look",
};

function plainShareLine(text: string): string {
  const exact: Record<string, string> = {
    "Capture the next release after deploying changes": "Save the next version after the fix is live.",
    "Open a focused Review Mission for first-use": "Ask someone to try the main task.",
    "Approve a brand version before the next visual pass":
      "Look at the page again before the next change.",
    "Triage the open finding": "Decide what to do about the open note.",
  };
  if (exact[text]) return exact[text];
  const prefixes: Array<[string, string]> = [
    ["Preview or export an improvement for:", "Hand off a fix for:"],
    ["Collect more evidence for:", "Add a clearer note for:"],
    ["Triage open finding:", "Decide what to do about:"],
  ];
  for (const [prefix, next] of prefixes) {
    if (text.startsWith(prefix)) return `${next} ${text.slice(prefix.length).trim()}`;
  }
  return text;
}

export function renderReportHtml(summary: Record<string, unknown>, origin: string): string {
  const label = escapeHtml(String(summary.label ?? "Report"));
  const next = Array.isArray(summary.next_three_actions)
    ? (summary.next_three_actions as string[])
        .map((a) => `<li>${escapeHtml(plainShareLine(a))}</li>`)
        .join("")
    : "";
  const findings = Array.isArray(summary.findings)
    ? (summary.findings as Array<Record<string, unknown>>)
        .map((f) => {
          const state = PLAIN_STATE[String(f.state)] ?? String(f.state).replaceAll("_", " ");
          const source = PLAIN_SOURCE[String(f.provenance)] ?? String(f.provenance).replaceAll("_", " ");
          return `<li><strong>${escapeHtml(String(f.title))}</strong> · ${escapeHtml(state)} · ${escapeHtml(source)}</li>`;
        })
        .join("")
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${label} · Shared report · OCLaunch</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="/favicon.svg" />
  <style>
    :root { --ink:#17252B; --canvas:#FAF8F5; --action:#C2410C; --muted:#59676D; }
    body { margin:0; font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; background:var(--canvas); color:var(--ink); }
    main { max-width:760px; margin:0 auto; padding:48px 20px; }
    .muted { color:var(--muted); }
  </style>
</head>
<body>
  <main>
    <p class="muted">Shared report</p>
    <h1>${label}</h1>
    <p class="muted">Saved ${escapeHtml(String(summary.captured_at ?? ""))}</p>
    <h2>Problems</h2>
    <ul>${findings || "<li class='muted'>None in this link.</li>"}</ul>
    <h2>What to do next</h2>
    <ol>${next}</ol>
    <p class="muted">Personal notes and screenshots are left out of this link.</p>
    <p><a href="${escapeHtml(origin)}">OCLaunch</a></p>
  </main>
</body>
</html>`;
}
