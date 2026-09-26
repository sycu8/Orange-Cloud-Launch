import { Hono } from "hono";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk } from "../lib/http.js";

export const workspaceRoutes = new Hono<AppEnv>();

workspaceRoutes.get("/workspace", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401);

  const projects = await c.env.DB.prepare(
    `SELECT p.id, p.name, p.slug, p.purpose, p.visibility, p.live_url, p.updated_at,
      (SELECT COUNT(*) FROM releases r WHERE r.project_id = p.id) as release_count,
      (SELECT COUNT(*) FROM missions m WHERE m.project_id = p.id AND m.state = 'open') as open_missions,
      (SELECT COUNT(*) FROM findings f WHERE f.project_id = p.id AND f.state IN ('observed','triaged','accepted','needs_evidence')) as open_findings,
      (SELECT r.id FROM releases r WHERE r.project_id = p.id ORDER BY r.captured_at DESC LIMIT 1) as latest_release_id,
      (SELECT r.label FROM releases r WHERE r.project_id = p.id ORDER BY r.captured_at DESC LIMIT 1) as latest_release_label
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = ?
     ORDER BY p.updated_at DESC`,
  )
    .bind(userId)
    .all();

  const credits = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ balance: number }>();

  const inboxCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM missions m
     JOIN projects p ON p.id = m.project_id
     WHERE m.state = 'open'
       AND p.visibility = 'public'
       AND p.owner_id != ?
       AND NOT EXISTS (
         SELECT 1 FROM reviews r WHERE r.mission_id = m.id AND r.reviewer_id = ?
       )`,
  )
    .bind(userId, userId)
    .first<{ n: number }>();

  return jsonOk(c, {
    projects: projects.results ?? [],
    credits: credits?.balance ?? 0,
    reviewInboxCount: inboxCount?.n ?? 0,
  });
});

workspaceRoutes.get("/review-inbox", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401);

  // Fair exposure: projects waiting longest first; exclude own + already reviewed.
  const rows = await c.env.DB.prepare(
    `SELECT m.id as mission_id, m.title, m.instructions, m.language, m.topic_tags, m.created_at,
            p.id as project_id, p.name as project_name, p.slug, p.audience, p.category,
            r.id as release_id, r.label as release_label
     FROM missions m
     JOIN projects p ON p.id = m.project_id
     JOIN releases r ON r.project_id = m.project_id AND r.id = m.release_id
     WHERE m.state = 'open'
       AND p.visibility = 'public'
       AND p.owner_id != ?
       AND NOT EXISTS (
         SELECT 1 FROM reviews rev WHERE rev.mission_id = m.id AND rev.reviewer_id = ?
       )
     ORDER BY m.created_at ASC
     LIMIT 25`,
  )
    .bind(userId, userId)
    .all();

  // Invite tokens are hashed — return passport + instruct founders to share invite links.
  // For inbox matching we expose a scoped claim path using mission id + membership grant.
  return jsonOk(c, {
    missions: (rows.results ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        missionId: r.mission_id,
        title: r.title,
        instructions: r.instructions,
        language: r.language,
        topicTags: JSON.parse(String(r.topic_tags || "[]")),
        createdAt: r.created_at,
        projectId: r.project_id,
        projectName: r.project_name,
        slug: r.slug,
        audience: r.audience,
        category: r.category,
        releaseId: r.release_id,
        releaseLabel: r.release_label,
        passportPath: `/p/${r.slug}`,
      };
    }),
    note: "Matching excludes your own projects and prior reviews. The inbox lists public missions only. Unlisted and private missions need an invite link.",
  });
});

workspaceRoutes.get("/credits", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401);
  const balance = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ balance: number }>();
  const recent = await c.env.DB.prepare(
    `SELECT id, amount, reason, created_at FROM credit_ledger WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(userId)
    .all();
  return jsonOk(c, { balance: balance?.balance ?? 0, recent: recent.results ?? [] });
});
