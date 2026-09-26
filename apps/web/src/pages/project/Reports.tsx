import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Notice } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

type Report = {
  id: string;
  release_id: string;
  version: number;
  created_at: string;
};

type CompareResult = {
  newFindingTitles: string[];
  improvedTitles: string[];
  counts: { target: Record<string, number>; base: Record<string, number> };
  note: string;
};

export function ReportsPage() {
  const { id } = useParams();
  const { data } = useOutletContext<{ data: ProjectDetail }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api<{ reports: Report[] }>(`/api/projects/${id}/reports`);
    setReports(res.reports);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function share(reportId: string) {
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

  async function runCompare() {
    const [target, base] = data.releases;
    if (!target || !base) {
      setError("Need at least two releases to compare.");
      return;
    }
    try {
      const res = await api<CompareResult>(
        `/api/projects/${id}/releases/${target.id}/compare/${base.id}`,
      );
      setCompare(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Release reports</h2>
      <p className="mt-1 text-sm text-muted">
        Immutable snapshots for deciding what to improve next. No universal readiness score.
      </p>
      <div className="mt-4">
        <Button variant="secondary" onClick={() => void runCompare()}>
          Compare latest two releases
        </Button>
      </div>
      {compare ? (
        <div className="mt-4">
          <Notice title="Release comparison" tone="action">
            <p>{compare.note}</p>
            <p className="mt-2">
              New finding titles: {compare.newFindingTitles.length ? compare.newFindingTitles.join("; ") : "none"}
            </p>
            <p>
              Improved since previous:{" "}
              {compare.improvedTitles.length ? compare.improvedTitles.join("; ") : "none"}
            </p>
          </Notice>
        </div>
      ) : null}
      {reports.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Add a release to start tracking improvements."
            body="Generate a report from a release workspace after reviews or automated checks."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-[16px] border border-border bg-surface p-4">
              <p className="font-semibold">
                Report v{r.version} · {r.id}
              </p>
              <p className="text-sm text-muted">
                Release {r.release_id} · {r.created_at}
              </p>
              <Button className="mt-3" variant="secondary" onClick={() => void share(r.id)}>
                Create redacted share link
              </Button>
            </li>
          ))}
        </ul>
      )}
      {sharePath ? (
        <div className="mt-4">
          <Notice title="Share created" tone="action">
            <a href={sharePath}>{sharePath}</a> — revocable, screenshots omitted by default.
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
