import { Hono } from "hono";
import { createMissionSchema, submitReviewSchema } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId, randomToken, sha256Hex } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";

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
    `SELECT m.*, p.name as project_name, p.slug, p.live_url, r.source_url, r.label as release_label
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
    },
  });
});

missionRoutes.post("/invite/:token/reviews", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in to submit a review", 401);
  const token = c.req.param("token");
  const hash = await sha256Hex(token);
  const mission = await c.env.DB.prepare(
    `SELECT m.*, p.owner_id FROM missions m
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
    return jsonErr(c, "FORBIDDEN", "Self-review is not allowed", 403);
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
      `Reviewer outcome: ${parsed.data.outcome.replaceAll("_", " ")}`,
      `${parsed.data.tried}\n\nExpected: ${parsed.data.expected}\nStuck: ${parsed.data.stuck}\n\n${parsed.data.observations}`,
      "A subsequent reviewer matching the audience can complete the mission without the same stuck point.",
      ts,
      ts,
    ),
  ];

  for (const pin of parsed.data.pins) {
    // Ensure artifact belongs to project
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
    );
  }

  // Credit ledger — helpful critical feedback qualifies; no praise required
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
});
