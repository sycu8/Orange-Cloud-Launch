import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { nowIso } from "../lib/http.js";
import { processJob } from "./processor.js";
import type { BrowserRunBinding } from "../integrations/browser.js";

export async function enqueueJob(
  c: Context<AppEnv>,
  input: {
    projectId: string;
    kind: "review" | "patch" | "verify" | "report" | "domain" | "delete" | "export";
    idempotencyKey: string;
    context: Record<string, unknown>;
  },
): Promise<{ jobId: string; created: boolean }> {
  const existing = await c.env.DB.prepare(
    `SELECT id, state FROM jobs WHERE project_id = ? AND kind = ? AND idempotency_key = ?`,
  )
    .bind(input.projectId, input.kind, input.idempotencyKey)
    .first<{ id: string; state: string }>();
  if (existing) return { jobId: existing.id, created: false };

  const jobId = newId("job");
  const outboxId = newId("obx");
  const createdAt = nowIso();
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO jobs (id, project_id, kind, idempotency_key, state, context_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    ).bind(
      jobId,
      input.projectId,
      input.kind,
      input.idempotencyKey,
      JSON.stringify(input.context),
      createdAt,
      createdAt,
    ),
    c.env.DB.prepare(
      `INSERT INTO outbox (id, job_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      outboxId,
      jobId,
      `job.${input.kind}`,
      JSON.stringify({ jobId, kind: input.kind }),
      createdAt,
    ),
  ];
  await c.env.DB.batch(statements);

  // Best-effort immediate processing (local/dev without Queue binding).
  if (c.env.JOBS) {
    try {
      await c.env.JOBS.send({ jobId });
      await c.env.DB.prepare(`UPDATE outbox SET sent_at = ?, attempt_count = attempt_count + 1 WHERE id = ?`)
        .bind(nowIso(), outboxId)
        .run();
    } catch {
      // Relay will retry.
    }
  } else {
    await processJob(c.env, jobId);
    await c.env.DB.prepare(`UPDATE outbox SET sent_at = ?, attempt_count = attempt_count + 1 WHERE id = ?`)
      .bind(nowIso(), outboxId)
      .run();
  }

  return { jobId, created: true };
}

export async function relayOutbox(env: EnvLike, limit = 25): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id, job_id FROM outbox WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: string; job_id: string }>();
  let n = 0;
  for (const row of rows.results ?? []) {
    await processJob(env, row.job_id);
    await env.DB.prepare(
      `UPDATE outbox SET sent_at = ?, attempt_count = attempt_count + 1 WHERE id = ?`,
    )
      .bind(new Date().toISOString(), row.id)
      .run();
    n++;
  }
  return n;
}

type EnvLike = {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  BROWSER?: BrowserRunBinding;
  ENABLE_BROWSER_RUN: string;
  ENABLE_WORKERS_AI: string;
  ENABLE_PATCH_PR: string;
  RULESET_VERSION: string;
  APP_ENV: string;
};
