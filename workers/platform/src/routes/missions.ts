import { Hono, type Context } from "hono";
import { createMissionSchema, submitReviewSchema } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId, randomToken, sha256Hex } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";

const MAX_EVIDENCE_BYTES = 2_000_000;

function humanFindingTitle(data: {
  stuck: string;
  observations: string;
  outcome: string;
}): string {
  const stuck = data.stuck.trim();
  if (stuck) return stuck.length > 120 ? `${stuck.slice(0, 117)}…` : stuck;
  const obs = data.observations.trim().split(/\n/)[0] ?? "";
  if (obs) return obs.length > 120 ? `${obs.slice(0, 117)}…` : obs;
  return `Review: ${data.outcome.replaceAll("_", " ")}`;
}

async function storeReviewEvidence(
  c: Context<AppEnv>,
  projectId: string,
  releaseId: string,
  file: File,
) {
  if (file.size > MAX_EVIDENCE_BYTES) {
    return { error: jsonErr(c, "VALIDATION", "File exceeds 2MB upload cap", 400) };
  }
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/") || mime.includes("svg")) {
    return {
      error: jsonErr(c, "VALIDATION", "Pin evidence must be a PNG, JPEG, or WebP image", 400),
    };
  }
  const buf = await file.arrayBuffer();
  const hash = await sha256Hex(buf);
  const id = newId("art");
  const key = `projects/${projectId}/releases/${releaseId}/pins/${id}`;
  await c.env.ARTIFACTS.put(key, buf, {
    httpMetadata: { contentType: mime },
  });
  await c.env.DB.prepare(
    `INSERT INTO artifacts (id, project_id, release_id, r2_key, sha256, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, releaseId, key, hash, mime, file.size, nowIso())
    .run();
  return { id, mimeType: mime, sizeBytes: file.size };
}

export const missionRoutes = new Hono<AppEnv>();

missionRoutes.get("/projects/:projectId/missions", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM missions WHERE project_id = ? ORDER BY created_at DESC`,
  )
    .bind(projectId)
    .all();
  return jsonOk(c, { missions: rows.results ?? [] });
});

missionRoutes.post("/projects/:projectId/releases/:releaseId/missions", async (c) => {
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
  const parsed = createMissionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const id = newId("msn");
  const invite = randomToken(16);
  const inviteHash = await sha256Hex(invite);
  await c.env.DB.prepare(
    `INSERT INTO missions (
      id, project_id, release_id, title, instructions, topic_tags, language, state,
      invite_token_hash, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      releaseId,
      parsed.data.title,
      parsed.data.instructions,
      JSON.stringify(parsed.data.topicTags),
      parsed.data.language,
      parsed.data.state,
      inviteHash,
      c.get("userId") ?? null,
      nowIso(),
    )
    .run();
  await audit(c, "mission.create", "mission", id, projectId);
  return jsonOk(
    c,
    {
      id,
      inviteToken: invite,
      invitePath: `/review/${invite}`,
      ...parsed.data,
    },
    201,
  );
});

missionRoutes.get("/invite/:token", async (c) => {
  const token = c.req.param("token");
  const hash = await sha256Hex(token);
  const mission = await c.env.DB.prepare(
    `SELECT m.*, p.name as project_name, p.slug, p.live_url, p.owner_id,
            r.source_url, r.label as release_label
     FROM missions m
     JOIN projects p ON p.id = m.project_id
     JOIN releases r ON r.project_id = m.project_id AND r.id = m.release_id
     WHERE m.invite_token_hash = ? AND m.state = 'open'`,
  )
    .bind(hash)
    .first<Record<string, unknown>>();
  if (!mission) {
    return jsonErr(c, "NOT_FOUND", "Invite expired or unknown", 404, {
      nextAction: "Ask the founder for a new review invite link",
    });
  }
  const userId = c.get("userId");
  // Redacted: never expose private repo/integration data
  return jsonOk(c, {
    mission: {
      id: mission.id,
      projectId: mission.project_id,
      title: mission.title,
      instructions: mission.instructions,
      language: mission.language,
      projectName: mission.project_name,
      slug: mission.slug,
      liveUrl: mission.live_url,
      sourceUrl: mission.source_url,
      releaseLabel: mission.release_label,
      isOwner: Boolean(userId && userId === mission.owner_id),
    },
  });
});

async function submitReviewForMission(
  c: Context<AppEnv>,
  mission: { id: string; project_id: string; release_id: string; owner_id: string },
  userId: string,
) {
  if (mission.owner_id === userId) {
    return jsonErr(c, "FORBIDDEN", "Self-review is not allowed", 403);
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM reviews WHERE mission_id = ? AND reviewer_id = ?`,
  )
    .bind(mission.id, userId)
    .first();
  if (existing) {
    return jsonErr(c, "CONFLICT", "You already reviewed this mission", 409);
  }
  const parsed = submitReviewSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }

  const reviewId = newId("rev");
  const findingId = newId("fnd");
  const ts = nowIso();
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO reviews (
        id, project_id, mission_id, reviewer_id, audience_fit, outcome,
        tried, expected, stuck, observations, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      reviewId,
      mission.project_id,
      mission.id,
      userId,
      parsed.data.audienceFit,
      parsed.data.outcome,
      parsed.data.tried,
      parsed.data.expected,
      parsed.data.stuck,
      parsed.data.observations,
      ts,
    ),
    c.env.DB.prepare(
      `INSERT INTO findings (
        id, project_id, release_id, review_id, provenance, category, severity, confidence,
        title, body, acceptance_criterion, state, record_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'human_observation', 'First-use experience', ?, 'medium', ?, ?, ?, 'observed', 1, ?, ?)`,
    ).bind(
      findingId,
      mission.project_id,
      mission.release_id,
      reviewId,
      parsed.data.outcome === "could_not_complete" ? "high" : "medium",
      humanFindingTitle(parsed.data),
      [
        `Tried: ${parsed.data.tried}`,
        `Expected: ${parsed.data.expected}`,
        parsed.data.stuck ? `Stuck: ${parsed.data.stuck}` : null,
        `Observations: ${parsed.data.observations}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      "A subsequent reviewer matching the audience can complete the mission without the same stuck point.",
      ts,
      ts,
    ),
  ];

  for (const pin of parsed.data.pins) {
    const art = await c.env.DB.prepare(
      `SELECT id FROM artifacts WHERE project_id = ? AND id = ?`,
    )
      .bind(mission.project_id, pin.artifactId)
      .first();
    if (!art) continue;
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO annotations (
          id, project_id, artifact_id, review_id, x_norm, y_norm, note, viewport_width, viewport_height
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        newId("ann"),
        mission.project_id,
        pin.artifactId,
        reviewId,
        pin.xNorm,
        pin.yNorm,
        pin.note,
        pin.viewportWidth,
        pin.viewportHeight,
      ),
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO finding_evidence (project_id, finding_id, artifact_id)
         VALUES (?, ?, ?)`,
      ).bind(mission.project_id, findingId, pin.artifactId),
    );
  }

  const creditKey = `review:${reviewId}`;
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO credit_ledger (id, user_id, source_key, amount, reason, created_at)
       VALUES (?, ?, ?, 1, 'Completed review with observations', ?)`,
    ).bind(newId("crd"), userId, creditKey, ts),
  );

  await c.env.DB.batch(statements);
  await audit(c, "review.submit", "review", reviewId, mission.project_id);
  return jsonOk(c, { reviewId, findingId }, 201);
}

missionRoutes.post("/invite/:token/evidence", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in to upload evidence", 401);
  const token = c.req.param("token");
  const hash = await sha256Hex(token);
  const mission = await c.env.DB.prepare(
    `SELECT m.id, m.project_id, m.release_id, p.owner_id FROM missions m
     JOIN projects p ON p.id = m.project_id
     WHERE m.invite_token_hash = ? AND m.state = 'open'`,
  )
    .bind(hash)
    .first<{
      id: string;
      project_id: string;
      release_id: string;
      owner_id: string;
    }>();
  if (!mission) return jsonErr(c, "NOT_FOUND", "Invite expired or unknown", 404);
  if (mission.owner_id === userId) {
    return jsonErr(c, "FORBIDDEN", "Self-review evidence is not allowed", 403);
  }
  const form = await c.req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return jsonErr(c, "VALIDATION", "file is required", 400);
  }
  const stored = await storeReviewEvidence(c, mission.project_id, mission.release_id, file as File);
  if ("error" in stored && stored.error) return stored.error;
  return jsonOk(c, stored, 201);
});

missionRoutes.post("/invite/:token/reviews", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in to submit a review", 401);
  const token = c.req.param("token");
  const hash = await sha256Hex(token);
  const mission = await c.env.DB.prepare(
    `SELECT m.id, m.project_id, m.release_id, p.owner_id FROM missions m
     JOIN projects p ON p.id = m.project_id
     WHERE m.invite_token_hash = ? AND m.state = 'open'`,
  )
    .bind(hash)
    .first<{
      id: string;
      project_id: string;
      release_id: string;
      owner_id: string;
    }>();
  if (!mission) return jsonErr(c, "NOT_FOUND", "Invite expired or unknown", 404);
  return submitReviewForMission(c, mission, userId);
});

missionRoutes.post("/missions/:missionId/evidence", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in to upload evidence", 401);
  const missionId = c.req.param("missionId");
  const mission = await c.env.DB.prepare(
    `SELECT m.id, m.project_id, m.release_id, m.state, p.owner_id, p.visibility
     FROM missions m
     JOIN projects p ON p.id = m.project_id
     WHERE m.id = ?`,
  )
    .bind(missionId)
    .first<{
      id: string;
      project_id: string;
      release_id: string;
      state: string;
      owner_id: string;
      visibility: string;
    }>();
  if (!mission || mission.state !== "open") {
    return jsonErr(c, "NOT_FOUND", "Mission not open", 404);
  }
  if (mission.visibility === "private") {
    return jsonErr(c, "FORBIDDEN", "Private missions require an invite link", 403);
  }
  if (mission.owner_id === userId) {
    return jsonErr(c, "FORBIDDEN", "Self-review evidence is not allowed", 403);
  }
  const form = await c.req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return jsonErr(c, "VALIDATION", "file is required", 400);
  }
  const stored = await storeReviewEvidence(c, mission.project_id, mission.release_id, file as File);
  if ("error" in stored && stored.error) return stored.error;
  return jsonOk(c, stored, 201);
});

missionRoutes.post("/projects/:projectId/missions/:missionId/rotate-invite", async (c) => {
  const projectId = c.req.param("projectId");
  const missionId = c.req.param("missionId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const mission = await c.env.DB.prepare(
    `SELECT id, state FROM missions WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, missionId)
    .first<{ id: string; state: string }>();
  if (!mission) return jsonErr(c, "NOT_FOUND", "Mission not found", 404);
  if (mission.state !== "open") {
    return jsonErr(c, "VALIDATION", "Only open missions can issue invite links", 400);
  }
  const invite = randomToken(16);
  const inviteHash = await sha256Hex(invite);
  await c.env.DB.prepare(
    `UPDATE missions SET invite_token_hash = ? WHERE project_id = ? AND id = ?`,
  )
    .bind(inviteHash, projectId, missionId)
    .run();
  await audit(c, "mission.rotate_invite", "mission", missionId, projectId);
  return jsonOk(c, {
    inviteToken: invite,
    invitePath: `/review/${invite}`,
    note: "Previous invite links for this mission stop working after rotate.",
  });
});

/** Public/unlisted open missions can be reviewed from the inbox without the opaque invite token. */
missionRoutes.post("/missions/:missionId/reviews", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in to submit a review", 401);
  const missionId = c.req.param("missionId");
  const mission = await c.env.DB.prepare(
    `SELECT m.id, m.project_id, m.release_id, m.state, p.owner_id, p.visibility
     FROM missions m
     JOIN projects p ON p.id = m.project_id
     WHERE m.id = ?`,
  )
    .bind(missionId)
    .first<{
      id: string;
      project_id: string;
      release_id: string;
      state: string;
      owner_id: string;
      visibility: string;
    }>();
  if (!mission || mission.state !== "open") {
    return jsonErr(c, "NOT_FOUND", "Mission not open", 404);
  }
  if (mission.visibility === "private") {
    return jsonErr(c, "FORBIDDEN", "Private missions require an invite link", 403);
  }
  return submitReviewForMission(c, mission, userId);
});
