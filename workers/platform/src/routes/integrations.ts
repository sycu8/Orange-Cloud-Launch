import { Hono } from "hono";
import { moderationReportSchema } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { requireMember } from "../db/access.js";
import {
  deliveryDedupeKey,
  githubConfigured,
  verifyGitHubSignature,
} from "../integrations/github.js";
import { relayOutbox } from "../jobs/outbox.js";

export const integrationRoutes = new Hono<AppEnv>();

integrationRoutes.get("/projects/:projectId/integrations", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const rows = await c.env.DB.prepare(
    `SELECT id, provider, status, external_id, created_at, revoked_at
     FROM integration_connections WHERE project_id = ?`,
  )
    .bind(projectId)
    .all();
  return jsonOk(c, {
    connections: rows.results ?? [],
    githubAppConfigured: githubConfigured(c.env),
    flags: {
      patchPr: c.env.ENABLE_PATCH_PR === "true",
      browserRun: c.env.ENABLE_BROWSER_RUN === "true",
      workersAi: c.env.ENABLE_WORKERS_AI === "true",
      projectDomains: c.env.ENABLE_PROJECT_DOMAINS === "true",
    },
  });
});

integrationRoutes.post("/github/webhook", async (c) => {
  if (!c.env.GITHUB_WEBHOOK_SECRET) {
    return jsonErr(c, "INTEGRATION_NOT_CONFIGURED", "GitHub webhook secret not set", 503);
  }
  const raw = await c.req.arrayBuffer();
  const ok = await verifyGitHubSignature(
    c.env.GITHUB_WEBHOOK_SECRET,
    raw,
    c.req.header("X-Hub-Signature-256"),
  );
  if (!ok) return jsonErr(c, "UNAUTHORIZED", "Invalid GitHub signature", 401);
  const deliveryId = c.req.header("X-GitHub-Delivery") || newId("ghd");
  const sourceKey = await deliveryDedupeKey(deliveryId);
  try {
    await c.env.DB.prepare(
      `INSERT INTO usage_ledger (id, project_id, job_id, resource, quantity, unit, source_key, created_at)
       VALUES (?, 'platform', NULL, 'github_webhook', 1, 'delivery', ?, ?)`,
    )
      .bind(newId("use"), sourceKey, nowIso())
      .run();
  } catch {
    return jsonOk(c, { ok: true, deduped: true });
  }
  return jsonOk(c, { ok: true, deduped: false });
});

integrationRoutes.post("/moderation/reports", async (c) => {
  const userId = c.get("userId");
  if (!userId) return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401);
  const parsed = moderationReportSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const id = newId("mod");
  await c.env.DB.prepare(
    `INSERT INTO moderation_reports (id, reporter_id, target_type, target_id, reason, state, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  )
    .bind(
      id,
      userId,
      parsed.data.targetType,
      parsed.data.targetId,
      parsed.data.reason,
      nowIso(),
    )
    .run();
  return jsonOk(c, { id }, 201);
});

integrationRoutes.post("/internal/outbox/relay", async (c) => {
  // Local/dev maintenance endpoint — not a public control plane.
  if (c.env.APP_ENV === "production") {
    return jsonErr(c, "FORBIDDEN", "Use scheduled cron in production", 403);
  }
  const n = await relayOutbox(c.env);
  return jsonOk(c, { processed: n });
});
