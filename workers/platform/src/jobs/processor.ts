import { brandProfileToCss, RULESET_VERSION } from "@oclaunch/shared";
import { newId, sha256Hex } from "../lib/ids.js";
import { runDeterministicChecks } from "../integrations/deterministic.js";
import { runBrowserReview } from "../integrations/browser.js";
import { suggestFindings } from "../integrations/ai.js";
import { buildAgentExport } from "../integrations/export.js";
import { requestPatchPreview } from "../integrations/sandbox.js";

type EnvLike = {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  ENABLE_BROWSER_RUN: string;
  ENABLE_WORKERS_AI: string;
  ENABLE_PATCH_PR: string;
  RULESET_VERSION: string;
  APP_ENV: string;
};

export async function processJob(env: EnvLike, jobId: string): Promise<void> {
  const job = await env.DB.prepare(
    `SELECT id, project_id, kind, state, context_json FROM jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<{
      id: string;
      project_id: string;
      kind: string;
      state: string;
      context_json: string;
    }>();
  if (!job || job.state === "succeeded" || job.state === "failed") return;

  await env.DB.prepare(
    `UPDATE jobs SET state = 'running', updated_at = ? WHERE id = ?`,
  )
    .bind(new Date().toISOString(), jobId)
    .run();

  try {
    const ctx = JSON.parse(job.context_json) as Record<string, unknown>;
    let result: Record<string, unknown> = {};

    if (job.kind === "review") {
      result = await handleReview(env, job.project_id, ctx);
    } else if (job.kind === "report") {
      result = await handleReport(env, job.project_id, ctx);
    } else if (job.kind === "export") {
      result = await handleExport(env, job.project_id, ctx);
    } else if (job.kind === "patch") {
      result = await handlePatch(env, job.project_id, ctx);
    } else if (job.kind === "domain") {
      result = {
        status: "integration_not_configured",
        message:
          "Project-domain gateway provisioning requires owner-approved DNS inventory and Cloudflare credentials.",
      };
    } else {
      result = { status: "noop" };
    }

    await env.DB.prepare(
      `UPDATE jobs SET state = 'succeeded', result_json = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(JSON.stringify(result), new Date().toISOString(), jobId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : "job_failed";
    await env.DB.prepare(
      `UPDATE jobs SET state = 'failed', error_code = ?, result_json = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(
        "JOB_FAILED",
        JSON.stringify({ message }),
        new Date().toISOString(),
        jobId,
      )
      .run();
  }
}

async function handleReview(
  env: EnvLike,
  projectId: string,
  ctx: Record<string, unknown>,
) {
  const releaseId = String(ctx.releaseId ?? "");
  const release = await env.DB.prepare(
    `SELECT id, source_url, label FROM releases WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, releaseId)
    .first<{ id: string; source_url: string; label: string }>();
  if (!release) throw new Error("release_not_found");

  // Quota: automated reviews per project per month
  const month = new Date().toISOString().slice(0, 7);
  const usage = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM usage_ledger
     WHERE project_id = ? AND resource = 'automated_review' AND created_at LIKE ?`,
  )
    .bind(projectId, `${month}%`)
    .first<{ n: number }>();
  if ((usage?.n ?? 0) >= 2) {
    return {
      status: "quota_exceeded",
      message: "Automated review quota is 2 runs per project per month. Human reviews remain available.",
    };
  }

  const deterministic = await runDeterministicChecks(release.source_url);
  const browser = await runBrowserReview(env, release.source_url);
  const suggestions = await suggestFindings(env, {
    sourceUrl: release.source_url,
    deterministic,
  });

  const findingIds: string[] = [];
  for (const f of [...deterministic, ...suggestions]) {
    const id = newId("fnd");
    findingIds.push(id);
    await env.DB.prepare(
      `INSERT INTO findings (
        id, project_id, release_id, provenance, category, severity, confidence,
        title, body, acceptance_criterion, state, record_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'observed', 1, ?, ?)`,
    )
      .bind(
        id,
        projectId,
        releaseId,
        f.provenance,
        f.category,
        f.severity,
        f.confidence,
        f.title,
        f.body,
        f.acceptanceCriterion ?? null,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO usage_ledger (id, project_id, job_id, resource, quantity, unit, source_key, created_at)
     VALUES (?, ?, ?, 'automated_review', 1, 'run', ?, ?)`,
  )
    .bind(
      newId("use"),
      projectId,
      String(ctx.jobId ?? newId("job")),
      `review:${projectId}:${releaseId}:${month}`,
      new Date().toISOString(),
    )
    .run();

  return {
    status: "completed",
    findingIds,
    browser,
    deterministicCount: deterministic.length,
    suggestionCount: suggestions.length,
  };
}

async function handleReport(
  env: EnvLike,
  projectId: string,
  ctx: Record<string, unknown>,
) {
  const releaseId = String(ctx.releaseId ?? "");
  const release = await env.DB.prepare(
    `SELECT * FROM releases WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, releaseId)
    .first<Record<string, unknown>>();
  if (!release) throw new Error("release_not_found");

  const findings = await env.DB.prepare(
    `SELECT id, provenance, category, severity, confidence, title, state, acceptance_criterion
     FROM findings WHERE project_id = ? AND release_id = ? ORDER BY created_at ASC`,
  )
    .bind(projectId, releaseId)
    .all();

  const reviews = await env.DB.prepare(
    `SELECT r.outcome, r.audience_fit FROM reviews r
     JOIN missions m ON m.id = r.mission_id AND m.project_id = r.project_id
     WHERE r.project_id = ? AND m.release_id = ?`,
  )
    .bind(projectId, releaseId)
    .all();

  const brand = await env.DB.prepare(
    `SELECT id, version FROM brand_versions WHERE project_id = ? AND approved_at IS NOT NULL
     ORDER BY version DESC LIMIT 1`,
  )
    .bind(projectId)
    .first<{ id: string; version: number }>();

  const previous = await env.DB.prepare(
    `SELECT id, label FROM releases WHERE project_id = ? AND captured_at < ?
     ORDER BY captured_at DESC LIMIT 1`,
  )
    .bind(projectId, release.captured_at)
    .first<{ id: string; label: string }>();

  const byState: Record<string, number> = {};
  for (const f of findings.results ?? []) {
    const s = String((f as { state: string }).state);
    byState[s] = (byState[s] ?? 0) + 1;
  }

  const nextActions = recommendNextActions(findings.results as Array<Record<string, unknown>>);

  const summary = {
    report_version: 1,
    ruleset_version: env.RULESET_VERSION || RULESET_VERSION,
    brand_version_id: brand?.id ?? null,
    release_id: releaseId,
    commit_sha: release.commit_sha ?? null,
    captured_at: release.captured_at,
    source_url: release.source_url,
    label: release.label,
    viewports: ["1280x800", "390x844"],
    tested_tasks: reviews.results?.length ?? 0,
    human_reviews: {
      sample_size: reviews.results?.length ?? 0,
      outcomes: (reviews.results ?? []).map((r) => ({
        outcome: (r as { outcome: string }).outcome,
        audience_fit: (r as { audience_fit: string }).audience_fit,
      })),
    },
    findings: findings.results ?? [],
    counts_by_state: byState,
    previous_release: previous ?? null,
    untested_scope: [
      "Cross-browser rendering beyond Chromium deterministic fetch",
      "Authenticated multi-step journeys",
      "Performance budgets",
    ],
    next_three_actions: nextActions,
    note: "No universal readiness score. Coverage and concrete outcomes only.",
  };

  const versionRow = await env.DB.prepare(
    `SELECT COALESCE(MAX(version), 0) as v FROM reports WHERE project_id = ? AND release_id = ?`,
  )
    .bind(projectId, releaseId)
    .first<{ v: number }>();
  const version = (versionRow?.v ?? 0) + 1;
  const reportId = newId("rpt");
  const body = JSON.stringify(summary, null, 2);
  const hash = await sha256Hex(body);
  const key = `projects/${projectId}/reports/${reportId}/report.json`;
  await env.ARTIFACTS.put(key, body, {
    httpMetadata: { contentType: "application/json" },
  });
  const artifactId = newId("art");
  await env.DB.prepare(
    `INSERT INTO artifacts (id, project_id, release_id, r2_key, sha256, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, 'application/json', ?, ?)`,
  )
    .bind(artifactId, projectId, releaseId, key, hash, body.length, new Date().toISOString())
    .run();

  await env.DB.prepare(
    `INSERT INTO reports (id, project_id, release_id, version, ruleset_version, brand_version_id, artifact_id, summary_json, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      reportId,
      projectId,
      releaseId,
      version,
      env.RULESET_VERSION || RULESET_VERSION,
      brand?.id ?? null,
      artifactId,
      JSON.stringify(summary),
      new Date().toISOString(),
      (ctx.actorId as string) ?? null,
    )
    .run();

  return { status: "completed", reportId, version, artifactId };
}

async function handleExport(
  env: EnvLike,
  projectId: string,
  ctx: Record<string, unknown>,
) {
  const changeSetId = String(ctx.changeSetId ?? "");
  const bundle = await buildAgentExport(env, projectId, changeSetId);
  const body = JSON.stringify(bundle, null, 2);
  const hash = await sha256Hex(body);
  const artifactId = newId("art");
  const key = `projects/${projectId}/exports/${artifactId}/agent-bundle.json`;
  await env.ARTIFACTS.put(key, body, {
    httpMetadata: { contentType: "application/json" },
  });
  await env.DB.prepare(
    `INSERT INTO artifacts (id, project_id, r2_key, sha256, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, 'application/json', ?, ?)`,
  )
    .bind(artifactId, projectId, key, hash, body.length, new Date().toISOString())
    .run();
  await env.DB.prepare(
    `UPDATE change_sets SET export_artifact_id = ?, state = 'exported' WHERE project_id = ? AND id = ?`,
  )
    .bind(artifactId, projectId, changeSetId)
    .run();

  // Also emit CSS/JSON token companions when brand present
  if (bundle.brandProfile) {
    const css = brandProfileToCss(bundle.brandProfile);
    const cssKey = `projects/${projectId}/exports/${artifactId}/brand-tokens.css`;
    await env.ARTIFACTS.put(cssKey, css, {
      httpMetadata: { contentType: "text/css" },
    });
  }

  return { status: "completed", artifactId, key };
}

async function handlePatch(
  env: EnvLike,
  projectId: string,
  ctx: Record<string, unknown>,
) {
  const changeSetId = String(ctx.changeSetId ?? "");
  const result = await requestPatchPreview(env, projectId, changeSetId);
  if (result.status === "integration_not_configured") {
    await env.DB.prepare(
      `UPDATE change_sets SET state = 'awaiting_integration' WHERE project_id = ? AND id = ?`,
    )
      .bind(projectId, changeSetId)
      .run();
  }
  return result;
}

function recommendNextActions(
  findings: Array<Record<string, unknown>>,
): string[] {
  const accepted = findings.filter((f) => f.state === "accepted");
  const needsEvidence = findings.filter((f) => f.state === "needs_evidence");
  const observed = findings.filter((f) => f.state === "observed");
  const actions: string[] = [];
  if (accepted[0]) actions.push(`Preview or export an improvement for: ${accepted[0].title}`);
  if (needsEvidence[0]) actions.push(`Collect more evidence for: ${needsEvidence[0].title}`);
  if (observed[0]) actions.push(`Triage open finding: ${observed[0].title}`);
  while (actions.length < 3) {
    actions.push(
      [
        "Capture the next release after deploying changes",
        "Open a focused Review Mission for first-use",
        "Approve a brand version before the next visual pass",
      ][actions.length]!,
    );
  }
  return actions.slice(0, 3);
}
