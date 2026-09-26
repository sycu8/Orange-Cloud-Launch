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
  const live = liveHref ? `<p><a href="${liveHref}">Open live app</a></p>` : "";
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
  <title>${name} · Product Passport · OCLaunch</title>
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
    <p class="muted">Product Passport</p>
    <h1>${name}</h1>
    <p>${purpose}</p>
    <p class="muted">Audience: ${audience}</p>
    ${live}
    <h2>Release history</h2>
    <ul>${releases || "<li class='muted'>No public releases yet.</li>"}</ul>
    <p class="muted">Approved brand version: ${input.brandVersion ?? "none yet"}</p>
    <p><a href="/">OCLaunch</a> · A community project by Orangecloud</p>
  </main>
</body>
</html>`;
}

export function renderReportHtml(summary: Record<string, unknown>, origin: string): string {
  const label = escapeHtml(String(summary.label ?? "Release report"));
  const next = Array.isArray(summary.next_three_actions)
    ? (summary.next_three_actions as string[])
        .map((a) => `<li>${escapeHtml(a)}</li>`)
        .join("")
    : "";
  const findings = Array.isArray(summary.findings)
    ? (summary.findings as Array<Record<string, unknown>>)
        .map(
          (f) =>
            `<li><strong>${escapeHtml(String(f.title))}</strong> · ${escapeHtml(String(f.state))} · ${escapeHtml(String(f.provenance))}</li>`,
        )
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
    <p class="muted">Redacted shared report</p>
    <h1>${label}</h1>
    <p class="muted">Captured ${escapeHtml(String(summary.captured_at ?? ""))}</p>
    <h2>Findings</h2>
    <ul>${findings || "<li class='muted'>None listed in this share.</li>"}</ul>
    <h2>Next three actions</h2>
    <ol>${next}</ol>
    <p class="muted">No universal readiness score. Personal screenshots omitted by default.</p>
    <p><a href="${escapeHtml(origin)}">OCLaunch</a></p>
  </main>
</body>
</html>`;
}
