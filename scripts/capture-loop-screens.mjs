import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
import { join } from "path";

const ORIGIN = process.env.OCLAUNCH_ORIGIN || "http://localhost:8787";
const OUT = "/cursor/stores/self/media";
mkdirSync(OUT, { recursive: true });

async function api(page, path, { method = "GET", body } = {}) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const headers = {};
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const csrf = document.cookie
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("oc_csrf="));
      // CSRF is also set via auth/me response into memory; use meta from last me call stored on window
      if (window.__csrf) headers["X-CSRF-Token"] = window.__csrf;
      const res = await fetch(path, {
        method,
        headers,
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `${res.status} ${path}`);
      if (data.csrfToken) window.__csrf = data.csrfToken;
      return data;
    },
    { path, method, body },
  );
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto(`${ORIGIN}/signin`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Continue as local founder/i }).click();
  await page.waitForURL("**/app**");

  // Seed via API in-page
  await page.goto(`${ORIGIN}/app`, { waitUntil: "networkidle" });
  const me = await api(page, "/api/auth/me");
  const slug = `shot-${Date.now().toString(36)}`;
  const project = await api(page, "/api/projects", {
    method: "POST",
    body: {
      name: "Screenshot Loop",
      slug,
      purpose: "Show the guided improvement loop",
      audience: "Solo founders",
      primaryTask: "Ship a clearer CTA",
      liveUrl: "https://example.com",
      category: "productivity",
      visibility: "private",
    },
  });
  // refresh csrf after project create
  await api(page, "/api/auth/me");
  const release = await api(page, `/api/projects/${project.id}/releases`, {
    method: "POST",
    body: { label: "Release 1", sourceUrl: "https://example.com", commitSha: "deadbeef01" },
  });
  await api(page, `/api/projects/${project.id}/releases/${release.id}/findings`, {
    method: "POST",
    body: {
      title: "CTA below the fold",
      body: "Mobile users scroll past empty space before seeing the next action.",
      severity: "high",
    },
  });
  const releaseDetail = await api(page, `/api/projects/${project.id}/releases/${release.id}`);
  const finding = releaseDetail.findings[0];
  await api(page, `/api/projects/${project.id}/findings/${finding.id}`, {
    method: "PATCH",
    body: { state: "accepted", expectedVersion: finding.record_version },
  });
  const change = await api(page, `/api/projects/${project.id}/changes`, {
    method: "POST",
    body: { findingIds: [finding.id], baseSha: "deadbeef01" },
  });
  await api(page, `/api/projects/${project.id}/changes/${change.id}/mark-implemented`, {
    method: "POST",
    body: { deployedSha: "deadbeef01" },
  });
  await api(page, `/api/projects/${project.id}/releases/${release.id}/verify`, {
    method: "POST",
    body: {
      findingId: finding.id,
      criterion: "CTA visible without scrolling on mobile",
      result: "pass",
      checkedSha: "deadbeef01",
      notes: "Verified after deploy",
    },
  });
  const reportJob = await api(page, `/api/projects/${project.id}/releases/${release.id}/reports`, {
    method: "POST",
    body: {},
  });
  const reportParsed = reportJob.job?.result_json
    ? JSON.parse(reportJob.job.result_json)
    : null;

  await page.goto(`${ORIGIN}/app/projects/${project.id}/overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(OUT, "oclaunch-overview-loop-desktop.png"),
    fullPage: true,
  });

  await page.goto(`${ORIGIN}/app/projects/${project.id}/changes/${change.id}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(OUT, "oclaunch-change-studio-desktop.png"),
    fullPage: true,
  });

  if (reportParsed?.reportId) {
    await page.goto(
      `${ORIGIN}/app/projects/${project.id}/reports/${reportParsed.reportId}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(OUT, "oclaunch-report-detail-desktop.png"),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ORIGIN}/app/projects/${project.id}/overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(OUT, "oclaunch-overview-loop-mobile.png"),
    fullPage: true,
  });

  await page.goto(`${ORIGIN}/signin`, { waitUntil: "networkidle" });
  // may redirect if still logged in
  await page.goto(`${ORIGIN}/app`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: join(OUT, "oclaunch-workspace-mobile.png"),
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        me: me.user?.display_name,
        projectId: project.id,
        changeId: change.id,
        reportId: reportParsed?.reportId ?? null,
        media: [
          `${OUT}/oclaunch-overview-loop-desktop.png`,
          `${OUT}/oclaunch-change-studio-desktop.png`,
          `${OUT}/oclaunch-report-detail-desktop.png`,
          `${OUT}/oclaunch-overview-loop-mobile.png`,
          `${OUT}/oclaunch-workspace-mobile.png`,
        ],
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
