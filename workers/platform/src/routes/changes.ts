import { Hono } from "hono";
import { createChangeSetSchema } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";
import { enqueueJob } from "../jobs/outbox.js";
import { detectStackFromPackageJson } from "../integrations/stack.js";

export const changeRoutes = new Hono<AppEnv>();

changeRoutes.get("/projects/:projectId/changes", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM change_sets WHERE project_id = ? ORDER BY created_at DESC`,
  )
    .bind(projectId)
    .all();
  return jsonOk(c, { changeSets: rows.results ?? [] });
});

changeRoutes.post("/projects/:projectId/changes", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const parsed = createChangeSetSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  for (const fid of parsed.data.findingIds) {
    const f = await c.env.DB.prepare(
      `SELECT id, state FROM findings WHERE project_id = ? AND id = ?`,
    )
      .bind(projectId, fid)
      .first<{ id: string; state: string }>();
    if (!f) {
      return jsonErr(c, "VALIDATION", `Finding ${fid} not in project`, 400);
    }
    if (f.state !== "accepted" && f.state !== "change_proposed") {
      return jsonErr(
        c,
        "VALIDATION",
        `Finding ${fid} must be accepted before inclusion`,
        400,
      );
    }
  }
  const id = newId("chg");
  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO change_sets (
        id, project_id, base_sha, brand_version_id, state, version, created_at
      ) VALUES (?, ?, ?, ?, 'proposed', 1, ?)`,
    ).bind(
      id,
      projectId,
      parsed.data.baseSha,
      parsed.data.brandVersionId ?? null,
      nowIso(),
    ),
  ];
  for (const fid of parsed.data.findingIds) {
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO change_set_findings (project_id, change_set_id, finding_id) VALUES (?, ?, ?)`,
      ).bind(projectId, id, fid),
      c.env.DB.prepare(
        `UPDATE findings SET state = 'change_proposed', record_version = record_version + 1, updated_at = ?
         WHERE project_id = ? AND id = ?`,
      ).bind(nowIso(), projectId, fid),
    );
  }
  await c.env.DB.batch(stmts);
  await audit(c, "change_set.create", "change_set", id, projectId);
  return jsonOk(c, { id }, 201);
});

changeRoutes.post("/projects/:projectId/stack-detect", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const body = await c.req.json<{ packageJson?: string }>().catch(() => ({}));
  const raw = (body as { packageJson?: string }).packageJson?.trim();
  if (!raw) {
    return jsonErr(c, "VALIDATION", "Paste package.json contents for stack detection", 400, {
      nextAction: "Do not invent filenames from a URL-only scan — paste package.json from the repo",
    });
  }
  const profile = detectStackFromPackageJson(raw);
  return jsonOk(c, {
    ...profile,
    patchPrEnabled: c.env.ENABLE_PATCH_PR === "true",
    draftPrStatus:
      profile.supported && c.env.ENABLE_PATCH_PR === "true"
        ? "integration_not_configured"
        : profile.supported
          ? "integration_not_configured"
          : "use_agent_export",
  });
});

changeRoutes.post("/projects/:projectId/changes/:changeId/export", async (c) => {
  const projectId = c.req.param("projectId");
  const changeId = c.req.param("changeId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const { jobId } = await enqueueJob(c, {
    projectId,
    kind: "export",
    idempotencyKey: `export:${changeId}`,
    context: { changeSetId: changeId, actorId: c.get("userId") },
  });
  const job = await c.env.DB.prepare(`SELECT id, state, result_json FROM jobs WHERE id = ?`)
    .bind(jobId)
    .first();
  return jsonOk(c, { jobId, job });
});

changeRoutes.post("/projects/:projectId/changes/:changeId/build", async (c) => {
  const projectId = c.req.param("projectId");
  const changeId = c.req.param("changeId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const { jobId } = await enqueueJob(c, {
    projectId,
    kind: "patch",
    idempotencyKey: `patch:${changeId}:${Date.now()}`,
    context: { changeSetId: changeId, actorId: c.get("userId") },
  });
  const job = await c.env.DB.prepare(`SELECT id, state, result_json FROM jobs WHERE id = ?`)
    .bind(jobId)
    .first();
  return jsonOk(c, { jobId, job, note: "Draft PR path requires GitHub + Sandbox credentials" });
});

changeRoutes.post("/projects/:projectId/changes/:changeId/approve", async (c) => {
  const projectId = c.req.param("projectId");
  const changeId = c.req.param("changeId");
  const role = await requireMember(c, projectId, ["owner"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Owner approval required", 403);
  const body = await c.req.json<{ headSha?: string }>().catch(() => ({}));
  const cs = await c.env.DB.prepare(
    `SELECT head_sha, approved_sha FROM change_sets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, changeId)
    .first<{ head_sha: string | null; approved_sha: string | null }>();
  if (!cs) return jsonErr(c, "NOT_FOUND", "Change set not found", 404);
  const headSha = (body as { headSha?: string }).headSha || cs.head_sha;
  if (!headSha) {
    return jsonErr(c, "VALIDATION", "No head SHA to approve — build a preview/PR first", 400, {
      nextAction: "Use agent export, or configure GitHub + Sandbox for draft PR",
    });
  }
  await c.env.DB.prepare(
    `UPDATE change_sets SET approved_sha = ?, approved_by = ?, state = 'approved_for_merge'
     WHERE project_id = ? AND id = ?`,
  )
    .bind(headSha, c.get("userId") ?? null, projectId, changeId)
    .run();
  await audit(c, "change_set.approve", "change_set", changeId, projectId, { headSha });
  return jsonOk(c, { ok: true, approvedSha: headSha });
});

changeRoutes.get("/projects/:projectId/changes/:changeId/export-download", async (c) => {
  const projectId = c.req.param("projectId");
  const changeId = c.req.param("changeId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const cs = await c.env.DB.prepare(
    `SELECT export_artifact_id FROM change_sets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, changeId)
    .first<{ export_artifact_id: string | null }>();
  if (!cs?.export_artifact_id) {
    return jsonErr(c, "NOT_FOUND", "Export not generated yet", 404);
  }
  const art = await c.env.DB.prepare(
    `SELECT r2_key, mime_type FROM artifacts WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, cs.export_artifact_id)
    .first<{ r2_key: string; mime_type: string }>();
  if (!art) return jsonErr(c, "NOT_FOUND", "Artifact missing", 404);
  const obj = await c.env.ARTIFACTS.get(art.r2_key);
  if (!obj) return jsonErr(c, "NOT_FOUND", "Object missing in R2", 404);
  return new Response(obj.body, {
    headers: {
      "content-type": art.mime_type,
      "content-disposition": `attachment; filename="oclaunch-export-${changeId}.json"`,
    },
  });
});
