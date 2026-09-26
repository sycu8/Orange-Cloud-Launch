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
    `SELECT
       cs.*,
       (
         SELECT f.title
         FROM change_set_findings csf
         JOIN findings f ON f.project_id = csf.project_id AND f.id = csf.finding_id
         WHERE csf.project_id = cs.project_id AND csf.change_set_id = cs.id
         ORDER BY f.created_at ASC
         LIMIT 1
       ) AS lead_title,
       (
         SELECT COUNT(*)
         FROM change_set_findings csf
         WHERE csf.project_id = cs.project_id AND csf.change_set_id = cs.id
       ) AS finding_count
     FROM change_sets cs
     WHERE cs.project_id = ?
     ORDER BY cs.created_at DESC`,
  )
    .bind(projectId)
    .all();
  const changeSets = (rows.results ?? []).map((row) => ({
    ...row,
    finding_count: Number((row as { finding_count?: number | string }).finding_count ?? 0),
  }));
  return jsonOk(c, { changeSets });
});

changeRoutes.get("/projects/:projectId/changes/:changeId", async (c) => {
  const projectId = c.req.param("projectId");
  const changeId = c.req.param("changeId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const changeSet = await c.env.DB.prepare(
    `SELECT * FROM change_sets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, changeId)
    .first<Record<string, unknown>>();
  if (!changeSet) return jsonErr(c, "NOT_FOUND", "Change set not found", 404);
  const findings = await c.env.DB.prepare(
    `SELECT f.id, f.title, f.state, f.category, f.severity, f.provenance, f.acceptance_criterion,
            f.release_id, f.record_version, f.body
     FROM change_set_findings csf
     JOIN findings f ON f.project_id = csf.project_id AND f.id = csf.finding_id
     WHERE csf.project_id = ? AND csf.change_set_id = ?
     ORDER BY f.created_at ASC`,
  )
    .bind(projectId, changeId)
    .all();
  return jsonOk(c, {
    changeSet,
    findings: findings.results ?? [],
    paths: {
      agentExport: "configured",
      sandboxDraftPr: "integration_not_configured",
    },
  });
});

changeRoutes.post("/projects/:projectId/changes/:changeId/mark-implemented", async (c) => {
  const projectId = c.req.param("projectId");
  const changeId = c.req.param("changeId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const body = await c.req.json<{ notes?: string; deployedSha?: string }>().catch(() => ({}));
  const cs = await c.env.DB.prepare(
    `SELECT id, state FROM change_sets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, changeId)
    .first<{ id: string; state: string }>();
  if (!cs) return jsonErr(c, "NOT_FOUND", "Change set not found", 404);
  if (cs.state === "implemented") {
    return jsonOk(c, {
      ok: true,
      state: "implemented",
      nextAction: "Verify the live release revision — preview success is not production proof",
    });
  }
  const findingIds = await c.env.DB.prepare(
    `SELECT finding_id FROM change_set_findings WHERE project_id = ? AND change_set_id = ?`,
  )
    .bind(projectId, changeId)
    .all<{ finding_id: string }>();
  const ts = nowIso();
  const stmts = [
    c.env.DB.prepare(
      `UPDATE change_sets SET state = 'implemented', head_sha = COALESCE(?, head_sha)
       WHERE project_id = ? AND id = ?`,
    ).bind((body as { deployedSha?: string }).deployedSha ?? null, projectId, changeId),
  ];
  for (const row of findingIds.results ?? []) {
    stmts.push(
      c.env.DB.prepare(
        `UPDATE findings SET state = 'implemented', record_version = record_version + 1, updated_at = ?
         WHERE project_id = ? AND id = ? AND state IN ('accepted','change_proposed','implemented')`,
      ).bind(ts, projectId, row.finding_id),
    );
  }
  await c.env.DB.batch(stmts);
  await audit(c, "change_set.mark_implemented", "change_set", changeId, projectId, {
    notes: (body as { notes?: string }).notes ?? null,
    deployedSha: (body as { deployedSha?: string }).deployedSha ?? null,
  });
  return jsonOk(c, {
    ok: true,
    state: "implemented",
    nextAction: "Verify the live release revision — preview success is not production proof",
  });
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
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "sandbox");
  headers.set("content-disposition", "attachment; filename=\"oclaunch-export.json\"");
  return new Response(obj.body, { headers });
});
