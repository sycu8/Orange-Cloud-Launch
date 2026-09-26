import { Hono } from "hono";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";
import { renderReportHtml, renderPassportHtml } from "../public-html/render.js";

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.get("/projects/:projectId/reports", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const rows = await c.env.DB.prepare(
    `SELECT id, release_id, version, ruleset_version, created_at FROM reports
     WHERE project_id = ? ORDER BY created_at DESC`,
  )
    .bind(projectId)
    .all();
  return jsonOk(c, { reports: rows.results ?? [] });
});

reportRoutes.get("/projects/:projectId/reports/:reportId", async (c) => {
  const projectId = c.req.param("projectId");
  const reportId = c.req.param("reportId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const report = await c.env.DB.prepare(
    `SELECT * FROM reports WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, reportId)
    .first<{ summary_json: string } & Record<string, unknown>>();
  if (!report) return jsonErr(c, "NOT_FOUND", "Report not found", 404);
  return jsonOk(c, { report: { ...report, summary: JSON.parse(report.summary_json) } });
});

reportRoutes.post("/projects/:projectId/reports/:reportId/shares", async (c) => {
  const projectId = c.req.param("projectId");
  const reportId = c.req.param("reportId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const report = await c.env.DB.prepare(
    `SELECT summary_json FROM reports WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, reportId)
    .first<{ summary_json: string }>();
  if (!report) return jsonErr(c, "NOT_FOUND", "Report not found", 404);
  const full = JSON.parse(report.summary_json) as Record<string, unknown>;
  const redacted = {
    ...full,
    findings: Array.isArray(full.findings)
      ? (full.findings as Array<Record<string, unknown>>).map((f) => ({
          title: f.title,
          category: f.category,
          severity: f.severity,
          state: f.state,
          provenance: f.provenance,
        }))
      : [],
    note: "Redacted share — personal evidence and screenshots omitted by default.",
  };
  const id = newId("shr");
  const expires = new Date(Date.now() + 7 * 864e5).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO report_shares (id, project_id, report_id, redacted_json, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, reportId, JSON.stringify(redacted), expires, nowIso())
    .run();
  await audit(c, "report.share", "report_share", id, projectId);
  return jsonOk(c, { id, path: `/r/${id}`, expiresAt: expires }, 201);
});

reportRoutes.delete("/report-shares/:shareId", async (c) => {
  const shareId = c.req.param("shareId");
  const share = await c.env.DB.prepare(
    `SELECT project_id FROM report_shares WHERE id = ?`,
  )
    .bind(shareId)
    .first<{ project_id: string }>();
  if (!share) return jsonErr(c, "NOT_FOUND", "Share not found", 404);
  const role = await requireMember(c, share.project_id, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  await c.env.DB.prepare(
    `UPDATE report_shares SET revoked_at = ? WHERE id = ?`,
  )
    .bind(nowIso(), shareId)
    .run();
  await audit(c, "report.share_revoke", "report_share", shareId, share.project_id);
  return jsonOk(c, { ok: true });
});

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/discover", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT p.slug, p.name, p.description, p.purpose, p.audience, p.category, p.live_url,
            (SELECT COUNT(*) FROM missions m WHERE m.project_id = p.id AND m.state = 'open') as open_missions
     FROM projects p
     WHERE p.visibility = 'public'
     ORDER BY p.updated_at DESC
     LIMIT 50`,
  ).all();
  return jsonOk(c, { projects: rows.results ?? [] });
});

publicRoutes.get("/p/:slug", async (c) => {
  const slug = c.req.param("slug");
  const project = await c.env.DB.prepare(
    `SELECT id, slug, name, description, purpose, audience, primary_task, live_url, category, visibility
     FROM projects WHERE slug = ? AND visibility IN ('public','unlisted')`,
  )
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!project) {
    return c.html("<!doctype html><title>Not found</title><h1>Product not found</h1>", 404);
  }
  const releases = await c.env.DB.prepare(
    `SELECT label, captured_at, commit_sha FROM releases WHERE project_id = ? ORDER BY captured_at DESC LIMIT 5`,
  )
    .bind(project.id)
    .all();
  const brand = await c.env.DB.prepare(
    `SELECT profile_json, version FROM brand_versions
     WHERE project_id = ? AND approved_at IS NOT NULL ORDER BY version DESC LIMIT 1`,
  )
    .bind(project.id)
    .first<{ profile_json: string; version: number }>();
  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("application/json")) {
    return jsonOk(c, {
      project,
      releases: releases.results ?? [],
      brand: brand ? { version: brand.version, profile: JSON.parse(brand.profile_json) } : null,
    });
  }
  return c.html(
    renderPassportHtml({
      project,
      releases: (releases.results ?? []) as Array<Record<string, unknown>>,
      brandVersion: brand?.version ?? null,
      origin: c.env.APP_ORIGIN,
    }),
  );
});

publicRoutes.get("/r/:shareId", async (c) => {
  const shareId = c.req.param("shareId");
  const share = await c.env.DB.prepare(
    `SELECT * FROM report_shares WHERE id = ?`,
  )
    .bind(shareId)
    .first<{
      redacted_json: string;
      expires_at: string | null;
      revoked_at: string | null;
    }>();
  if (!share || share.revoked_at) {
    return c.html("<!doctype html><title>Unavailable</title><h1>Share revoked or missing</h1>", 404);
  }
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    return c.html("<!doctype html><title>Expired</title><h1>Share expired</h1>", 410);
  }
  const summary = JSON.parse(share.redacted_json) as Record<string, unknown>;
  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("application/json")) {
    return jsonOk(c, { summary });
  }
  return c.html(renderReportHtml(summary, c.env.APP_ORIGIN));
});
