import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Label, Notice, StatusPill } from "../../components/ui";
import { getCsrfToken } from "../../lib/api";

type Finding = {
  id: string;
  title: string;
  provenance: string;
  category: string;
  severity: string;
  state: string;
  record_version: number;
  acceptance_criterion: string | null;
};

export function ReleaseWorkspacePage() {
  const { id, releaseId } = useParams();
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [release, setRelease] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  async function load() {
    const data = await api<{ release: Record<string, unknown>; findings: Finding[] }>(
      `/api/projects/${id}/releases/${releaseId}`,
    );
    setRelease(data.release);
    setFindings(data.findings);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id, releaseId]);

  async function triage(f: Finding, state: string) {
    setError(null);
    try {
      await api(`/api/projects/${id}/findings/${f.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          state,
          expectedVersion: f.record_version,
          dismissRationale: state === "dismissed" ? "Out of scope for this release" : undefined,
        }),
      });
      setNote(`Finding marked ${state.replaceAll("_", " ")}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function verify(f: Finding) {
    try {
      await api(`/api/projects/${id}/releases/${releaseId}/verify`, {
        method: "POST",
        body: JSON.stringify({
          findingId: f.id,
          criterion: f.acceptance_criterion || f.title,
          result: "pass",
          checkedSha: release?.commit_sha ?? undefined,
          notes: "Owner verified against the captured release revision.",
        }),
      });
      setNote("Verification recorded — preview success is not claimed as production proof.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function uploadEvidence(file: File) {
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("releaseId", releaseId ?? "");
    try {
      const headers: HeadersInit = {};
      const csrf = getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const res = await fetch(`/api/projects/${id}/artifacts`, {
        method: "POST",
        body,
        credentials: "include",
        headers,
      });
      const data = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setUploadNote(`Evidence stored as ${data.id} (private R2). SVG/HTML uploads are blocked.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function generateReport() {
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/releases/${releaseId}/reports`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { reportId?: string })
        : null;
      if (parsed?.reportId) {
        setNote(`Report ${parsed.reportId} created`);
        navigate(`/app/projects/${id}/reports/${parsed.reportId}`);
      } else {
        setNote("Report job finished");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!release) return <p className="text-muted">Loading release…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{String(release.label)}</h2>
          <p className="text-sm text-muted">{String(release.source_url)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={String(release.source_url)} target="_blank" rel="noreferrer">
            <Button variant="secondary">Open app in new tab</Button>
          </a>
          <Button onClick={() => void generateReport()}>Generate report</Button>
          <Link to={`/app/projects/${id}/missions`}>
            <Button variant="ghost">Create mission</Button>
          </Link>
        </div>
      </div>
      {note ? <Notice title="Update" tone="positive">{note}</Notice> : null}
      {uploadNote ? (
        <div className="mt-3">
          <Notice title="Evidence uploaded" tone="positive">
            {uploadNote}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Notice title="Error" tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
      <div className="mt-6 rounded-[16px] border border-border bg-surface p-4">
        <Label>Upload release evidence (image / text / JSON, max 2MB)</Label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,text/plain,application/json"
          className="mt-2 block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadEvidence(file);
          }}
        />
      </div>
      <h3 className="mt-6 text-lg font-semibold">Findings</h3>
      {findings.length === 0 ? (
        <EmptyState
          title="No findings yet"
          body="Run an automated review or collect a human mission review for this release."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="rounded-[16px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">{f.title}</h4>
                <StatusPill tone="neutral">{f.provenance}</StatusPill>
                <StatusPill tone={f.state === "verified" ? "positive" : "action"}>
                  {f.state.replaceAll("_", " ")}
                </StatusPill>
                <StatusPill tone="neutral">{f.severity}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-muted">
                {f.category}
                {f.acceptance_criterion ? ` · Criterion: ${f.acceptance_criterion}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void triage(f, "triaged")}>
                  Triage
                </Button>
                <Button onClick={() => void triage(f, "accepted")}>Accept</Button>
                <Button variant="ghost" onClick={() => void triage(f, "needs_evidence")}>
                  Need evidence
                </Button>
                <Button variant="ghost" onClick={() => void triage(f, "dismissed")}>
                  Dismiss
                </Button>
                {(f.state === "accepted" || f.state === "change_proposed") && (
                  <Button variant="secondary" onClick={() => void triage(f, "implemented")}>
                    Mark implemented
                  </Button>
                )}
                {(f.state === "implemented" ||
                  f.state === "accepted" ||
                  f.state === "verification_pending" ||
                  f.state === "change_proposed") && (
                  <Button variant="secondary" onClick={() => void verify(f)}>
                    Mark verified
                  </Button>
                )}
                {f.state === "accepted" ? (
                  <Link to={`/app/projects/${id}/changes`}>
                    <Button variant="ghost">Propose change</Button>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
