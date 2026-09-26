import { brandProfileToCss, DEFAULT_QUOTAS, RULESET_VERSION } from "@oclaunch/shared";
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
      result = await handleReview(env, job.project_id, ctx, job.id);
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

async function reserveAutomatedReview(
  env: EnvLike,
  projectId: string,
  jobId: string,
): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7);
  const sourceKey = `review:${projectId}:${month}:${jobId}`;
  const existing = await env.DB.prepare(`SELECT id FROM usage_ledger WHERE source_key = ?`)
    .bind(sourceKey)
    .first();
  if (existing) return true;
  const inserted = await env.DB.prepare(
    `INSERT INTO usage_ledger (id, project_id, job_id, resource, quantity, unit, source_key, created_at)
     SELECT ?, ?, ?, 'automated_review', 1, 'run', ?, ?
     WHERE (
       SELECT COUNT(*) FROM usage_ledger
       WHERE project_id = ? AND resource = 'automated_review' AND created_at LIKE ?
     ) < ?`,
  )
    .bind(
      newId("use"),
      projectId,
      jobId,
      sourceKey,
      new Date().toISOString(),
      projectId,
      `${month}%`,
      DEFAULT_QUOTAS.automatedReviewsPerProjectPerMonth,
    )
    .run();
  return (inserted.meta.changes ?? 0) > 0;
}

async function handleReview(
  env: EnvLike,
  projectId: string,
  ctx: Record<string, unknown>,
  jobId: string,
) {
  const releaseId = String(ctx.releaseId ?? "");
  const release = await env.DB.prepare(
    `SELECT id, source_url, label FROM releases WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, releaseId)
    .first<{ id: string; source_url: string; label: string }>();
  if (!release) throw new Error("release_not_found");

  const reserved = await reserveAutomatedReview(env, projectId, jobId);
  if (!reserved) {
    return {
      status: "quota_exceeded",
      message: "Automated review quota is 2 runs per project per month. Human reviews remain available.",
    };
  }

  const allowLoopback = env.APP_ENV === "development";
  const deterministic = await runDeterministicChecks(release.source_url, { allowLoopback });
  const fetchBlocked = deterministic.some((item) =>
    /blocked|credentials|not a valid|could not be checked/i.test(item.title),
  );
  const browser = fetchBlocked
    ? {
        status: "skipped" as const,
        message: "Release URL was not fetched.",
        sourceUrl: "",
      }
    : await runBrowserReview(env, release.source_url);
  const suggestions = await suggestFindings(env, {
    sourceUrl: fetchBlocked ? "" : release.source_url,
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

  const project = await env.DB.prepare(`SELECT live_url FROM projects WHERE id = ?`)
    .bind(projectId)
    .first<{ live_url: string | null }>();

  let priorFindings: Array<Record<string, unknown>> = [];
  if (previous) {
    const prior = await env.DB.prepare(
      `SELECT title, state FROM findings WHERE project_id = ? AND release_id = ?`,
    )
      .bind(projectId, previous.id)
      .all();
    priorFindings = (prior.results ?? []) as Array<Record<string, unknown>>;
  }

  const byState: Record<string, number> = {};
  const byProvenance: Record<string, number> = {};
  for (const f of findings.results ?? []) {
    const row = f as { state: string; provenance: string };
    byState[row.state] = (byState[row.state] ?? 0) + 1;
    byProvenance[row.provenance] = (byProvenance[row.provenance] ?? 0) + 1;
  }

  const currentTitles = new Set(
    (findings.results ?? []).map((f) => String((f as { title: string }).title)),
  );
  const reopened = (findings.results ?? []).filter(
    (f) => (f as { state: string }).state === "reopened",
  );
  const verifiedNotRechecked = priorFindings.filter((f) => {
    const title = String(f.title);
    const state = String(f.state);
    return state === "verified" && !currentTitles.has(title);
  });

  const outcomeCounts: Record<string, number> = {};
  for (const r of reviews.results ?? []) {
    const o = String((r as { outcome: string }).outcome);
    outcomeCounts[o] = (outcomeCounts[o] ?? 0) + 1;
  }

  const nextActions = recommendNextActions(findings.results as Array<Record<string, unknown>>);
  const reviewedUrl = String(release.reviewed_url || release.source_url || "");
  const liveUrl = project?.live_url ?? null;
  const environment = String(release.environment || "preview");
  const envGap =
    liveUrl && reviewedUrl && liveUrl.replace(/\/$/, "") !== reviewedUrl.replace(/\/$/, "")
      ? {
          reviewedUrl,
          liveUrl,
          message:
            environment === "production"
              ? "Reviewed URL differs from the project live URL — do not treat this as verified on production live."
              : `Human tried ${environment} at a URL that is not the project live URL.`,
        }
      : null;

  const humanFindings = (findings.results ?? []).filter(
    (f) => (f as { provenance: string }).provenance === "human_observation",
  );
  const otherFindings = (findings.results ?? []).filter(
    (f) => (f as { provenance: string }).provenance !== "human_observation",
  );

  const summary = {
    report_version: 2,
    ruleset_version: env.RULESET_VERSION || RULESET_VERSION,
    brand_version_id: brand?.id ?? null,
    release_id: releaseId,
    commit_sha: release.commit_sha ?? null,
    captured_at: release.captured_at,
    source_url: release.source_url,
    reviewed_url: reviewedUrl,
    live_url: liveUrl,
    environment,
    environment_gap: envGap,
    label: release.label,
    viewports: ["1280x800", "390x844"],
    tested_tasks: reviews.results?.length ?? 0,
    human_reviews: {
      sample_size: reviews.results?.length ?? 0,
      outcome_counts: outcomeCounts,
      outcomes: (reviews.results ?? []).map((r) => ({
        outcome: (r as { outcome: string }).outcome,
        audience_fit: (r as { audience_fit: string }).audience_fit,
      })),
      note: "could_not_complete is a successful critical review — praise is not required.",
    },
    reopened_findings: reopened,
    verified_not_rechecked: verifiedNotRechecked.map((f) => ({
      title: f.title,
      prior_state: f.state,
    })),
    findings: [...humanFindings, ...otherFindings],
    counts_by_state: byState,
    counts_by_provenance: byProvenance,
    previous_release: previous ?? null,
    untested_scope: [
      "Cross-browser rendering beyond Chromium deterministic fetch",
      "Authenticated multi-step journeys",
      "Performance budgets",
      ...(environment !== "production"
        ? ["Production live URL was not the human review target for this report"]
        : []),
    ],
    next_three_actions: nextActions,
    note: "No universal readiness score. Human task results first; deterministic fetch notes are not human outcomes.",
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
