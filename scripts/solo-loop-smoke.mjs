/**
 * Solo founder loop smoke test against local platform (DEV_AUTH_BYPASS).
 * Usage: node scripts/solo-loop-smoke.mjs
 */
const ORIGIN = process.env.OCLAUNCH_ORIGIN || "http://localhost:8787";

async function req(path, { method = "GET", body, cookie, csrf } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${data.message || JSON.stringify(data)}`);
  }
  return { data, setCookie, cookieHeader: mergeCookies(cookie, setCookie) };
}

function mergeCookies(prev, setCookie) {
  const jar = new Map();
  for (const part of (prev || "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const sc of setCookie) {
    const first = sc.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const slug = `loop-${Date.now().toString(36)}`;
  let cookie = "";
  let csrf = "";

  const login = await req("/api/auth/dev-login", {
    method: "POST",
    body: { displayName: "Solo Loop Founder" },
  });
  cookie = login.cookieHeader;
  csrf = login.data.csrfToken;

  const project = await req("/api/projects", {
    method: "POST",
    cookie,
    csrf,
    body: {
      name: "Solo Loop App",
      slug,
      purpose: "Finish one improvement loop alone",
      audience: "Solo founders",
      primaryTask: "Ship a clearer first-run CTA",
      liveUrl: "https://example.com",
      category: "productivity",
      visibility: "private",
    },
  });
  const projectId = project.data.id;
  csrf = (await req("/api/auth/me", { cookie })).data.csrfToken || csrf;

  const release = await req(`/api/projects/${projectId}/releases`, {
    method: "POST",
    cookie,
    csrf,
    body: {
      label: "v0.1 local",
      sourceUrl: "https://example.com/preview",
      reviewedUrl: "https://example.com/preview",
      environment: "preview",
      commitSha: "abc1234deadbeef",
    },
  });
  const releaseId = release.data.id;
  if ((release.data.defaultMissions ?? 0) < 5) {
    throw new Error("expected 5 default dangerous-path missions");
  }
  const missions = await req(`/api/projects/${projectId}/missions`, { cookie });
  if ((missions.data.missions?.length ?? 0) < 5) {
    throw new Error("missions not created with release");
  }

  const finding = await req(`/api/projects/${projectId}/releases/${releaseId}/findings`, {
    method: "POST",
    cookie,
    csrf,
    body: {
      title: "Primary CTA below the fold on mobile",
      body: "On a 390px viewport the Add plan button required scrolling past empty hero space.",
      category: "First-use experience",
      severity: "high",
    },
  });
  const findingId = finding.data.id;

  const detail = await req(`/api/projects/${projectId}/releases/${releaseId}`, { cookie });
  const row = detail.data.findings.find((f) => f.id === findingId);
  if (!row) throw new Error("finding missing after create");

  await req(`/api/projects/${projectId}/findings/${findingId}`, {
    method: "PATCH",
    cookie,
    csrf,
    body: { state: "accepted", expectedVersion: row.record_version },
  });

  const change = await req(`/api/projects/${projectId}/changes`, {
    method: "POST",
    cookie,
    csrf,
    body: { findingIds: [findingId], baseSha: "abc1234deadbeef" },
  });
  const changeId = change.data.id;

  await req(`/api/projects/${projectId}/changes/${changeId}/export`, {
    method: "POST",
    cookie,
    csrf,
    body: {},
  });

  await req(`/api/projects/${projectId}/changes/${changeId}/mark-implemented`, {
    method: "POST",
    cookie,
    csrf,
    body: { deployedSha: "abc1234deadbeef", notes: "Shipped via coding agent" },
  });

  await req(`/api/projects/${projectId}/releases/${releaseId}/verify`, {
    method: "POST",
    cookie,
    csrf,
    body: {
      findingId,
      criterion: "CTA visible without scrolling on 390px",
      result: "pass",
      checkedSha: "abc1234deadbeef",
      notes: "Verified on example.com snapshot",
    },
  });

  const reportJob = await req(`/api/projects/${projectId}/releases/${releaseId}/reports`, {
    method: "POST",
    cookie,
    csrf,
    body: {},
  });
  const reportParsed = reportJob.data.job?.result_json
    ? JSON.parse(reportJob.data.job.result_json)
    : null;
  if (!reportParsed?.reportId) throw new Error("reportId missing from job result");

  const report = await req(
    `/api/projects/${projectId}/reports/${reportParsed.reportId}`,
    { cookie },
  );
  const changeDetail = await req(`/api/projects/${projectId}/changes/${changeId}`, { cookie });
  const loop = (await req(`/api/projects/${projectId}`, { cookie })).data.loop;

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId,
        releaseId,
        findingId,
        changeId,
        changeState: changeDetail.data.changeSet.state,
        reportId: reportParsed.reportId,
        nextActions: report.data.report.summary.next_three_actions,
        loop,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
