import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, EmptyState, Notice, StatusPill } from "../../components/ui";

type ReportSummary = {
  label?: string;
  captured_at?: string;
  source_url?: string;
  reviewed_url?: string;
  live_url?: string | null;
  environment?: string;
  environment_gap?: { reviewedUrl: string; liveUrl: string; message: string } | null;
  commit_sha?: string | null;
  ruleset_version?: string;
  human_reviews?: {
    sample_size: number;
    outcome_counts?: Record<string, number>;
    note?: string;
  };
  counts_by_state?: Record<string, number>;
  counts_by_provenance?: Record<string, number>;
  reopened_findings?: Array<{ id: string; title: string; state: string }>;
  verified_not_rechecked?: Array<{ title: string; prior_state: string }>;
  findings?: Array<{
    id: string;
    title: string;
    state: string;
    provenance: string;
    category: string;
    severity: string;
  }>;
  next_three_actions?: string[];
  untested_scope?: string[];
  previous_release?: { id: string; label: string } | null;
  note?: string;
};

type ReportRow = {
  id: string;
  release_id: string;
  version: number;
  ruleset_version: string;
  created_at: string;
  summary: ReportSummary;
};

function outcomeLabel(key: string) {
  return key.replaceAll("_", " ");
}

export function ReportDetailPage() {
  const { id, reportId } = useParams();
  const { t } = useI18n();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !reportId) return;
    api<{ report: ReportRow }>(`/api/projects/${id}/reports/${reportId}`)
      .then((d) => setReport(d.report))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id, reportId]);

  async function share() {
    if (!id || !reportId) return;
    try {
      const res = await api<{ path: string }>(
        `/api/projects/${id}/reports/${reportId}/shares`,
        { method: "POST", body: "{}" },
      );
      setSharePath(res.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (error && !report) {
    return (
      <Notice title={t("reports.notFound")} tone="danger">
        {error.includes("NOT_FOUND") || /not found/i.test(error)
          ? t("reports.notFoundBody")
          : error}
      </Notice>
    );
  }
  if (!report) return <p className="text-muted">{t("reports.loading")}</p>;

  const summary = report.summary ?? {};
  const counts = summary.counts_by_state ?? {};
  const findings = summary.findings ?? [];
  const humanFindings = findings.filter((f) => f.provenance === "human_observation");
  const otherFindings = findings.filter((f) => f.provenance !== "human_observation");
  const outcomeEntries = Object.entries(summary.human_reviews?.outcome_counts ?? {});

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/app/projects/${id}/reports`} className="text-muted">
          {t("nav.reports")}
        </Link>{" "}
        / v{report.version}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{summary.label ?? `Report v${report.version}`}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("reports.captured")} {summary.captured_at ?? report.created_at}
            {summary.commit_sha ? ` · ${summary.commit_sha}` : ""}
            {` · ${t("reports.ruleset")} ${summary.ruleset_version ?? report.ruleset_version}`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t("reports.environment")}: <strong>{summary.environment ?? "preview"}</strong>
            {summary.reviewed_url ? ` · ${t("reports.tried")} ${summary.reviewed_url}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/app/projects/${id}/releases/${report.release_id}`}>
            <Button variant="secondary">{t("reports.openRelease")}</Button>
          </Link>
          <Button onClick={() => void share()}>{t("reports.createShare")}</Button>
        </div>
      </div>

      {summary.environment_gap ? (
        <div className="mt-4">
          <Notice title={t("reports.envGapTitle")} tone="danger">
            <p>{summary.environment_gap.message}</p>
            <p className="mt-1">
              {t("findings.tried")}: {summary.environment_gap.reviewedUrl}
              <br />
              {t("reports.live")}: {summary.environment_gap.liveUrl}
            </p>
            <p className="mt-1">{t("reports.envGapWarn")}</p>
          </Notice>
        </div>
      ) : (
        <div className="mt-4">
          <Notice title={t("reports.snapshotTitle")} tone="action">
            {summary.note ?? t("reports.snapshotDefault")}
          </Notice>
        </div>
      )}

      <h3 className="mt-8 text-lg font-semibold">{t("reports.humanOutcomes")}</h3>
      <p className="text-sm text-muted">
        {t("reports.sampleSize")} {summary.human_reviews?.sample_size ?? 0}.{" "}
        {summary.human_reviews?.note ?? "could_not_complete counts as useful critical feedback."}
      </p>
      {outcomeEntries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("reports.noCommunity")}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {outcomeEntries.map(([key, n]) => (
            <li key={key}>
              <StatusPill tone={key === "could_not_complete" ? "action" : "neutral"}>
                {n} {outcomeLabel(key)}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-lg font-semibold">{t("reports.reopened")}</h3>
      {(summary.reopened_findings?.length ?? 0) === 0 &&
      (summary.verified_not_rechecked?.length ?? 0) === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("reports.reopenedNone")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {(summary.reopened_findings ?? []).map((f) => (
            <li key={f.id} className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm">
              {t("reports.reopenedItem")}: {f.title}
            </li>
          ))}
          {(summary.verified_not_rechecked ?? []).map((f) => (
            <li
              key={f.title}
              className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm"
            >
              {t("reports.notRechecked")}: {f.title}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-lg font-semibold">{t("reports.untested")}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {(summary.untested_scope ?? []).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <h3 className="mt-8 text-lg font-semibold">{t("reports.nextThree")}</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5">
        {(summary.next_three_actions ?? []).map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ol>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-sm text-muted">{t("reports.verified")}</p>
          <p className="text-2xl font-bold text-positive">{counts.verified ?? 0}</p>
        </div>
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-sm text-muted">{t("reports.stillOpen")}</p>
          <p className="text-2xl font-bold">
            {(counts.observed ?? 0) +
              (counts.triaged ?? 0) +
              (counts.accepted ?? 0) +
              (counts.needs_evidence ?? 0)}
          </p>
        </div>
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-sm text-muted">{t("reports.humanObs")}</p>
          <p className="text-2xl font-bold">
            {summary.counts_by_provenance?.human_observation ?? humanFindings.length}
          </p>
        </div>
      </div>

      <h3 className="mt-8 text-lg font-semibold">{t("reports.findingsHumanFirst")}</h3>
      {findings.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={t("reports.noFindingsSnap")}
            body={t("reports.noFindingsSnapBody")}
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {[...humanFindings, ...otherFindings].map((f) => (
            <li key={f.id} className="rounded-[16px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{f.title}</p>
                <StatusPill tone={f.state === "verified" ? "positive" : "action"}>
                  {f.state.replaceAll("_", " ")}
                </StatusPill>
                <StatusPill tone="neutral">{f.provenance.replaceAll("_", " ")}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-muted">
                {f.category} · {f.severity}
              </p>
            </li>
          ))}
        </ul>
      )}

      {summary.previous_release ? (
        <p className="mt-6 text-sm text-muted">
          {t("reports.previous")}: {summary.previous_release.label}
        </p>
      ) : null}

      {sharePath ? (
        <div className="mt-6">
          <Notice title={t("reports.shareCreated")} tone="positive">
            <a href={sharePath}>{sharePath}</a> — {t("reports.shareRevocable")}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice title={t("common.error")} tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
