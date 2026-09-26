import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n, useLabel } from "../../lib/i18n";
import { categoryLabel, outcomeLabel, plainStoredLine, stateLabel } from "../../lib/plain-copy";
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
    note?: string | null;
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

function formatWhen(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function connectedVersion(sha: string | null | undefined) {
  if (!sha || sha === "not-connected" || sha.length < 7) return null;
  return sha;
}

export function ReportDetailPage() {
  const { id, reportId } = useParams();
  const { t } = useI18n();
  const label = useLabel();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !reportId) return;
    api<{ report: ReportRow }>(`/api/projects/${id}/reports/${reportId}`)
      .then((d) => setReport(d.report))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id, reportId]);

  async function share() {
    if (!id || !reportId) return;
    setCopied(false);
    setSharing(true);
    setError(null);
    try {
      const res = await api<{ path: string }>(
        `/api/projects/${id}/reports/${reportId}/shares`,
        { method: "POST", body: "{}" },
      );
      setSharePath(res.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSharing(false);
    }
  }

  const shareUrl =
    sharePath && typeof window !== "undefined"
      ? sharePath.startsWith("http")
        ? sharePath
        : `${window.location.origin}${sharePath}`
      : sharePath;

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setError(t("reports.copyFailed"));
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
  const versionCode = connectedVersion(summary.commit_sha);
  const ruleset = summary.ruleset_version ?? report.ruleset_version;
  const nextActions = summary.next_three_actions ?? [];
  const untested = summary.untested_scope ?? [];
  const sampleSize = summary.human_reviews?.sample_size ?? 0;

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/app/projects/${id}/reports`} className="text-muted">
          {t("nav.reports")}
        </Link>
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold">
            {summary.label ?? t("reports.record")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("reports.captured")} {formatWhen(summary.captured_at ?? report.created_at)}
          </p>
          <p className="mt-1 break-all text-sm text-muted">
            {t("reports.environment")}:{" "}
            <strong>{label("env", summary.environment ?? "preview")}</strong>
            {summary.reviewed_url ? (
              <>
                {" "}
                · {t("reports.tried")} {summary.reviewed_url}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to={`/app/projects/${id}/releases/${report.release_id}`} className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              {t("reports.openRelease")}
            </Button>
          </Link>
          <Button className="w-full sm:w-auto" disabled={sharing} onClick={() => void share()}>
            {sharing ? t("reports.sharing") : t("reports.createShare")}
          </Button>
        </div>
      </div>

      {shareUrl ? (
        <div className="mt-4">
          <Notice title={t("reports.shareCreated")} tone="positive">
            <a className="break-all" href={sharePath ?? shareUrl}>
              {shareUrl}
            </a>
            <p className="mt-2">{t("reports.shareRevocable")}</p>
            <Button className="mt-3 w-full sm:w-auto" variant="secondary" onClick={() => void copyShare()}>
              {copied ? t("reports.copied") : t("reports.copyLink")}
            </Button>
          </Notice>
        </div>
      ) : null}

      {versionCode || ruleset ? (
        <details className="mt-4 rounded-[12px] border border-border p-3">
          <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
            {t("changes.tech")}
          </summary>
          <p className="mt-2 text-sm text-muted">{t("reports.techHelp")}</p>
          {versionCode ? (
            <p className="mt-2 break-all text-sm">
              {t("reports.techVersion")}: {versionCode}
            </p>
          ) : null}
          {ruleset ? (
            <p className="mt-1 text-sm text-muted">
              {t("reports.ruleset")}: {ruleset}
            </p>
          ) : null}
        </details>
      ) : null}

      {summary.environment_gap ? (
        <div className="mt-4">
          <Notice title={t("reports.envGapTitle")} tone="danger">
            <p className="break-all">
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
            {t("reports.snapshotDefault")}
          </Notice>
        </div>
      )}

      <h3 className="mt-8 text-lg font-semibold">{t("reports.humanOutcomes")}</h3>
      <p className="text-sm text-muted">
        {t("reports.sampleSize")}: {sampleSize}.
        {sampleSize > 0 ? ` ${t("reports.sampleNote")}` : null}
      </p>
      {outcomeEntries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("reports.noCommunity")}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {outcomeEntries.map(([key, n]) => (
            <li key={key}>
              <StatusPill tone={key === "could_not_complete" ? "action" : "neutral"}>
                {n} {outcomeLabel(t, key)}
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
      {untested.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("reports.untestedNone")}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {untested.map((item) => (
            <li key={item}>{plainStoredLine(t, item)}</li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-lg font-semibold">{t("reports.nextThree")}</h3>
      {nextActions.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("reports.nextNone")}</p>
      ) : (
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          {nextActions.map((action) => (
            <li key={action}>{plainStoredLine(t, action)}</li>
          ))}
        </ol>
      )}

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
                  {stateLabel(t, f.state)}
                </StatusPill>
                <StatusPill tone="neutral">{label("provenance", f.provenance)}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-muted">
                {categoryLabel(t, f.category)} · {label("severity", f.severity)}
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
