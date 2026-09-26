import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Notice, StatusPill } from "../../components/ui";

type ReportSummary = {
  label?: string;
  captured_at?: string;
  source_url?: string;
  commit_sha?: string | null;
  ruleset_version?: string;
  viewports?: string[];
  tested_tasks?: number;
  human_reviews?: { sample_size: number };
  counts_by_state?: Record<string, number>;
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

export function ReportDetailPage() {
  const { id, reportId } = useParams();
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
      <Notice title="Report unavailable" tone="danger">
        {error}
      </Notice>
    );
  }
  if (!report) return <p className="text-muted">Loading report…</p>;

  const summary = report.summary ?? {};
  const counts = summary.counts_by_state ?? {};
  const findings = summary.findings ?? [];

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/app/projects/${id}/reports`} className="text-muted">
          Reports
        </Link>{" "}
        / v{report.version}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{summary.label ?? `Report v${report.version}`}</h2>
          <p className="mt-1 text-sm text-muted">
            Captured {summary.captured_at ?? report.created_at}
            {summary.commit_sha ? ` · ${summary.commit_sha}` : ""}
            {` · ruleset ${summary.ruleset_version ?? report.ruleset_version}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/app/projects/${id}/releases/${report.release_id}`}>
            <Button variant="secondary">Open release</Button>
          </Link>
          <Button onClick={() => void share()}>Create redacted share</Button>
        </div>
      </div>

      <Notice title="Evidence-based snapshot" tone="action">
        {summary.note ?? "No universal readiness score. Coverage and concrete outcomes only."}
      </Notice>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-sm text-muted">Human reviews</p>
          <p className="text-2xl font-bold">{summary.human_reviews?.sample_size ?? 0}</p>
          <p className="text-xs text-muted">sample size · conditions on mission</p>
        </div>
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-sm text-muted">Verified</p>
          <p className="text-2xl font-bold text-positive">{counts.verified ?? 0}</p>
        </div>
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-sm text-muted">Still open</p>
          <p className="text-2xl font-bold">
            {(counts.observed ?? 0) +
              (counts.triaged ?? 0) +
              (counts.accepted ?? 0) +
              (counts.needs_evidence ?? 0)}
          </p>
        </div>
      </div>

      <h3 className="mt-8 text-lg font-semibold">Next three actions</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5">
        {(summary.next_three_actions ?? []).map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ol>

      <h3 className="mt-8 text-lg font-semibold">Findings</h3>
      {findings.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No findings in this snapshot" body="Generate again after reviews." />
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="rounded-[16px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{f.title}</p>
                <StatusPill tone={f.state === "verified" ? "positive" : "action"}>
                  {f.state.replaceAll("_", " ")}
                </StatusPill>
                <StatusPill tone="neutral">{f.provenance}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-muted">
                {f.category} · {f.severity}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-lg font-semibold">Untested scope</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {(summary.untested_scope ?? []).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      {summary.previous_release ? (
        <p className="mt-6 text-sm text-muted">
          Compared context includes previous release: {summary.previous_release.label}
        </p>
      ) : null}

      {sharePath ? (
        <div className="mt-6">
          <Notice title="Share created" tone="positive">
            <a href={sharePath}>{sharePath}</a> — revocable; screenshots omitted by default.
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice title="Error" tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
