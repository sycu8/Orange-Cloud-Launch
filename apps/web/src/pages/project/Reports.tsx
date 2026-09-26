import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Notice } from "../../components/ui";

type Report = {
  id: string;
  release_id: string;
  version: number;
  created_at: string;
};

export function ReportsPage() {
  const { id } = useParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [sharePath, setSharePath] = useState<string | null>(null);
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

  return (
    <div>
      <h2 className="text-xl font-semibold">Release reports</h2>
      <p className="mt-1 text-sm text-muted">
        Immutable snapshots for deciding what to improve next. No universal readiness score.
      </p>
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
