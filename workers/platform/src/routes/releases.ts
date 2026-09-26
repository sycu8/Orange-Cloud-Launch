import { Hono } from "hono";
import {
  buildCreateReleaseSchema,
  DANGEROUS_PATH_MISSIONS,
  RULESET_VERSION,
} from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId, randomToken, sha256Hex } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";
import { enqueueJob } from "../jobs/outbox.js";

export const releaseRoutes = new Hono<AppEnv>();

releaseRoutes.post("/projects/:projectId/releases", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const parsed = buildCreateReleaseSchema({
    allowLoopbackHttp: c.env.APP_ENV === "development",
  }).safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const id = newId("rel");
  const capturedAt = nowIso();
  const reviewedUrl = parsed.data.reviewedUrl || parsed.data.sourceUrl;
  await c.env.DB.prepare(
    `INSERT INTO releases (
      id, project_id, label, source_url, commit_sha, deployment_id, ruleset_version,
      captured_at, created_by, environment, reviewed_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      parsed.data.label,
      parsed.data.sourceUrl,
      parsed.data.commitSha ?? null,
      parsed.data.deploymentId ?? null,
      c.env.RULESET_VERSION || RULESET_VERSION,
      capturedAt,
      c.get("userId") ?? null,
      parsed.data.environment,
      reviewedUrl,
    )
    .run();
  // Default five dangerous-path missions — could_not_complete is a successful review.
  const missionStmts = [];
  for (const pack of DANGEROUS_PATH_MISSIONS) {
    const missionId = newId("msn");
    const invite = randomToken(16);
    const inviteHash = await sha256Hex(invite);
    missionStmts.push(
      c.env.DB.prepare(
        `INSERT INTO missions (
          id, project_id, release_id, title, instructions, topic_tags, language, state,
          invite_token_hash, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'en', 'open', ?, ?, ?)`,
      ).bind(
        missionId,
        projectId,
        id,
        pack.title,
        pack.instructions,
        JSON.stringify([...pack.topicTags]),
        inviteHash,
        c.get("userId") ?? null,
        capturedAt,
      ),
    );
  }
  if (missionStmts.length) await c.env.DB.batch(missionStmts);

  await audit(c, "release.create", "release", id, projectId);
  return jsonOk(
    c,
    {
      id,
      capturedAt,
      reviewedUrl,
      defaultMissions: DANGEROUS_PATH_MISSIONS.length,
      ...parsed.data,
    },
    201,
  );
});

releaseRoutes.get("/projects/:projectId/releases/:releaseId", async (c) => {
  const projectId = c.req.param("projectId");
  const releaseId = c.req.param("releaseId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const release = await c.env.DB.prepare(
    `SELECT * FROM releases WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, releaseId)
    .first();
  if (!release) return jsonErr(c, "NOT_FOUND", "Release not found", 404);
  const findings = await c.env.DB.prepare(
    `SELECT * FROM findings WHERE project_id = ? AND release_id = ? ORDER BY created_at DESC`,
  )
    .bind(projectId, releaseId)
    .all();
  const missions = await c.env.DB.prepare(
    `SELECT id, title, instructions, state, created_at FROM missions
     WHERE project_id = ? AND release_id = ? ORDER BY created_at DESC`,
  )
    .bind(projectId, releaseId)
    .all();
  return jsonOk(c, {
    release,
    findings: findings.results ?? [],
    missions: missions.results ?? [],
  });
});

releaseRoutes.post("/projects/:projectId/releases/:releaseId/runs", async (c) => {
  const projectId = c.req.param("projectId");
  const releaseId = c.req.param("releaseId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const body = await c.req.json<{ idempotencyKey?: string }>().catch(() => ({}));
  const clientKey = (body as { idempotencyKey?: string }).idempotencyKey;
  const key =
    clientKey && /^[A-Za-z0-9:_-]{1,80}$/.test(clientKey)
      ? `review:${releaseId}:${clientKey}`
      : `review:${releaseId}:${new Date().toISOString().slice(0, 10)}`;
  const { jobId, created } = await enqueueJob(c, {
    projectId,
    kind: "review",
    idempotencyKey: key,
    context: { releaseId, actorId: c.get("userId") },
  });
  const job = await c.env.DB.prepare(`SELECT id, state, result_json, error_code FROM jobs WHERE id = ?`)
    .bind(jobId)
    .first();
  return jsonOk(c, { jobId, created, job }, created ? 202 : 200);
});

releaseRoutes.post("/projects/:projectId/releases/:releaseId/reports", async (c) => {
  const projectId = c.req.param("projectId");
  const releaseId = c.req.param("releaseId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const { jobId } = await enqueueJob(c, {
    projectId,
    kind: "report",
    idempotencyKey: `report:${releaseId}:${Date.now()}`,
    context: { releaseId, actorId: c.get("userId") },
  });
  const job = await c.env.DB.prepare(`SELECT id, state, result_json FROM jobs WHERE id = ?`)
    .bind(jobId)
    .first();
  return jsonOk(c, { jobId, job }, 202);
});

releaseRoutes.post("/projects/:projectId/releases/:releaseId/verify", async (c) => {
  const projectId = c.req.param("projectId");
  const releaseId = c.req.param("releaseId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const body = await c.req.json<{
    findingId: string;
    checkedSha?: string;
    criterion: string;
    result: "pass" | "fail" | "inconclusive";
    notes?: string;
  }>();
  if (!body.findingId || !body.criterion || !body.result) {
    return jsonErr(c, "VALIDATION", "findingId, criterion, result required", 400);
  }
  const finding = await c.env.DB.prepare(
    `SELECT id, state, record_version FROM findings WHERE project_id = ? AND id = ? AND release_id = ?`,
  )
    .bind(projectId, body.findingId, releaseId)
    .first<{ id: string; state: string; record_version: number }>();
  if (!finding) return jsonErr(c, "NOT_FOUND", "Finding not found on this release", 404);

  const id = newId("ver");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO verifications (
        id, project_id, finding_id, release_id, checked_sha, criterion, result, notes, checked_at, checked_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      projectId,
      body.findingId,
      releaseId,
      body.checkedSha ?? null,
      body.criterion,
      body.result,
      body.notes ?? "",
      nowIso(),
      c.get("userId") ?? null,
    ),
    c.env.DB.prepare(
      `UPDATE findings SET state = ?, record_version = record_version + 1, updated_at = ?
       WHERE project_id = ? AND id = ?`,
    ).bind(
      body.result === "pass" ? "verified" : "verification_pending",
      nowIso(),
      projectId,
      body.findingId,
    ),
  ]);
  await audit(c, "verification.create", "verification", id, projectId, body);
  return jsonOk(c, { id, findingState: body.result === "pass" ? "verified" : "verification_pending" }, 201);
});
