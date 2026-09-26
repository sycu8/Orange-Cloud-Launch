import { Hono } from "hono";
import { createOwnerFindingSchema, triageFindingSchema } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";

export const findingRoutes = new Hono<AppEnv>();

findingRoutes.post("/projects/:projectId/releases/:releaseId/findings", async (c) => {
  const projectId = c.req.param("projectId");
  const releaseId = c.req.param("releaseId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const release = await c.env.DB.prepare(
    `SELECT id FROM releases WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, releaseId)
    .first();
  if (!release) return jsonErr(c, "NOT_FOUND", "Release not found", 404);
  const parsed = createOwnerFindingSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const id = newId("fnd");
  const ts = nowIso();
  const body = `Founder note (not a community review):\n\n${parsed.data.body}`;
  await c.env.DB.prepare(
    `INSERT INTO findings (
      id, project_id, release_id, review_id, provenance, category, severity, confidence,
      title, body, acceptance_criterion, state, record_version, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, 'human_observation', ?, ?, 'medium', ?, ?, ?, 'observed', 1, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      releaseId,
      parsed.data.category,
      parsed.data.severity,
      parsed.data.title,
      body,
      parsed.data.acceptanceCriterion ??
        "A reviewer matching the audience can complete the related task without this friction.",
      ts,
      ts,
    )
    .run();
  await audit(c, "finding.owner_create", "finding", id, projectId);
  return jsonOk(c, { id, state: "observed" }, 201);
});

findingRoutes.patch("/projects/:projectId/findings/:findingId", async (c) => {
  const projectId = c.req.param("projectId");
  const findingId = c.req.param("findingId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const parsed = triageFindingSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  if (parsed.data.state === "dismissed" && !parsed.data.dismissRationale) {
    return jsonErr(c, "VALIDATION", "Dismissal requires a rationale", 400);
  }
  const current = await c.env.DB.prepare(
    `SELECT record_version FROM findings WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, findingId)
    .first<{ record_version: number }>();
  if (!current) return jsonErr(c, "NOT_FOUND", "Finding not found", 404);
  if (current.record_version !== parsed.data.expectedVersion) {
    return jsonErr(c, "VERSION_CONFLICT", "Finding was updated by someone else", 409, {
      nextAction: "Reload the finding and retry with the latest version",
      retryable: true,
    });
  }
  const updated = await c.env.DB.prepare(
    `UPDATE findings SET
      state = ?,
      dismiss_rationale = COALESCE(?, dismiss_rationale),
      acceptance_criterion = COALESCE(?, acceptance_criterion),
      record_version = record_version + 1,
      updated_at = ?
     WHERE project_id = ? AND id = ? AND record_version = ?`,
  )
    .bind(
      parsed.data.state,
      parsed.data.dismissRationale ?? null,
      parsed.data.acceptanceCriterion ?? null,
      nowIso(),
      projectId,
      findingId,
      parsed.data.expectedVersion,
    )
    .run();
  if (!updated.meta.changes) {
    return jsonErr(c, "VERSION_CONFLICT", "Finding was updated by someone else", 409, {
      retryable: true,
    });
  }
  await audit(c, "finding.triage", "finding", findingId, projectId, parsed.data);
  return jsonOk(c, { ok: true, recordVersion: parsed.data.expectedVersion + 1 });
});
