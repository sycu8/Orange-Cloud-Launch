import { Hono } from "hono";
import { createProjectSchema, updateProjectSchema, DEFAULT_QUOTAS } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";

export const projectRoutes = new Hono<AppEnv>();

projectRoutes.get("/projects", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401);
  const rows = await c.env.DB.prepare(
    `SELECT p.* FROM projects p
     JOIN project_members m ON m.project_id = p.id
     WHERE m.user_id = ?
     ORDER BY p.updated_at DESC`,
  )
    .bind(userId)
    .all();
  return jsonOk(c, { projects: rows.results ?? [] });
});

projectRoutes.post("/projects", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401);
  const parsed = createProjectSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM projects WHERE owner_id = ?`,
  )
    .bind(userId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= DEFAULT_QUOTAS.projectsPerAccount) {
    return jsonErr(c, "QUOTA_EXCEEDED", "Account project quota is 3", 429, {
      nextAction: "Archive or delete an existing project before creating another",
    });
  }
  const id = newId("prj");
  const input = parsed.data;
  const ts = nowIso();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO projects (
          id, owner_id, slug, name, description, purpose, audience, primary_task,
          live_url, category, visibility, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).bind(
        id,
        userId,
        input.slug,
        input.name,
        input.description,
        input.purpose,
        input.audience,
        input.primaryTask,
        input.liveUrl || null,
        input.category,
        input.visibility,
        ts,
        ts,
      ),
      c.env.DB.prepare(
        `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')`,
      ).bind(id, userId),
      c.env.DB.prepare(
        `INSERT INTO integration_connections (id, project_id, provider, status, config_json, created_at)
         VALUES (?, ?, 'github', 'not_configured', '{}', ?)`,
      ).bind(newId("int"), id, ts),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("UNIQUE")) {
      return jsonErr(c, "CONFLICT", "Slug already taken", 409);
    }
    throw err;
  }
  await audit(c, "project.create", "project", id, id);
  return jsonOk(c, { id, ...input }, 201);
});

projectRoutes.get("/projects/:id", async (c) => {
  const id = c.req.param("id");
  const role = await requireMember(c, id);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access to this project", 403);
  const project = await c.env.DB.prepare(`SELECT * FROM projects WHERE id = ?`)
    .bind(id)
    .first();
  if (!project) return jsonErr(c, "NOT_FOUND", "Project not found", 404);
  const releases = await c.env.DB.prepare(
    `SELECT id, label, source_url, commit_sha, captured_at FROM releases
     WHERE project_id = ? ORDER BY captured_at DESC LIMIT 10`,
  )
    .bind(id)
    .all();
  return jsonOk(c, { project, role, releases: releases.results ?? [] });
});

projectRoutes.patch("/projects/:id", async (c) => {
  const id = c.req.param("id");
  const role = await requireMember(c, id, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const parsed = updateProjectSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const current = await c.env.DB.prepare(`SELECT * FROM projects WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!current) return jsonErr(c, "NOT_FOUND", "Project not found", 404);
  const next = { ...current, ...mapProjectPatch(parsed.data) };
  await c.env.DB.prepare(
    `UPDATE projects SET
      name = ?, slug = ?, description = ?, purpose = ?, audience = ?, primary_task = ?,
      live_url = ?, category = ?, visibility = ?, version = version + 1, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      next.name,
      next.slug,
      next.description,
      next.purpose,
      next.audience,
      next.primary_task,
      next.live_url,
      next.category,
      next.visibility,
      nowIso(),
      id,
    )
    .run();
  await audit(c, "project.update", "project", id, id);
  return jsonOk(c, { ok: true });
});

function mapProjectPatch(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (data.name !== undefined) out.name = data.name;
  if (data.slug !== undefined) out.slug = data.slug;
  if (data.description !== undefined) out.description = data.description;
  if (data.purpose !== undefined) out.purpose = data.purpose;
  if (data.audience !== undefined) out.audience = data.audience;
  if (data.primaryTask !== undefined) out.primary_task = data.primaryTask;
  if (data.liveUrl !== undefined) out.live_url = data.liveUrl || null;
  if (data.category !== undefined) out.category = data.category;
  if (data.visibility !== undefined) out.visibility = data.visibility;
  return out;
}
