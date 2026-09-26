import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Input, Label, Notice, StatusPill, TextArea } from "../../components/ui";
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
  const [findingTitle, setFindingTitle] = useState("");
  const [findingBody, setFindingBody] = useState("");
  const [findingCategory, setFindingCategory] = useState("First-use experience");

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

  async function runAutomated() {
    setError(null);
    setNote(null);
    try {
      const result = await api<{ job: { state: string; result_json?: string } }>(
        `/api/projects/${id}/releases/${releaseId}/runs`,
        { method: "POST", body: "{}" },
      );
      const parsed = result.job.result_json
        ? (JSON.parse(result.job.result_json) as { status?: string; message?: string; deterministicCount?: number })
        : null;
      if (parsed?.status === "quota_exceeded") {
        setError(parsed.message ?? "Quota exceeded");
      } else {
        setNote(
          `Automated checks finished. Deterministic findings may appear below; Browser Run stays not-configured until credentials are set.`,
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function logFinding(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/projects/${id}/releases/${releaseId}/findings`, {
        method: "POST",
        body: JSON.stringify({
          title: findingTitle,
          body: findingBody,
          category: findingCategory,
          severity: "medium",
        }),
      });
      setFindingTitle("");
      setFindingBody("");
      setNote("Founder note logged. Accept it, then propose an improvement.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
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
          <Button variant="secondary" onClick={() => void runAutomated()}>
            Run automated checks
          </Button>
          <Button onClick={() => void generateReport()}>Generate report</Button>
          <Link to={`/app/projects/${id}/missions`}>
            <Button variant="ghost">Invite a reviewer</Button>
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

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => void logFinding(e)}
          className="space-y-3 rounded-[16px] border border-border bg-surface p-4"
        >
          <h3 className="font-semibold">Log a founder note</h3>
          <p className="text-sm text-muted">
            Working alone? Capture friction yourself, accept it, export an improvement, then verify.
            Community reviews stay separate.
          </p>
          <div>
            <Label>What should get better</Label>
            <Input
              required
              value={findingTitle}
              onChange={(e) => setFindingTitle(e.target.value)}
              placeholder="Primary CTA is easy to miss on first visit"
            />
          </div>
          <div>
            <Label>What you observed</Label>
            <TextArea
              required
              value={findingBody}
              onChange={(e) => setFindingBody(e.target.value)}
              placeholder="Tried to create a plan; the next step was below the fold on mobile."
            />
          </div>
          <div>
            <Label>Category</Label>
            <select
              className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
              value={findingCategory}
              onChange={(e) => setFindingCategory(e.target.value)}
            >
              <option>First-use experience</option>
              <option>Access</option>
              <option>Regression</option>
              <option>Clarity</option>
              <option>Visual consistency</option>
              <option>Accessibility</option>
              <option>Release presentation</option>
            </select>
          </div>
          <Button type="submit">Add finding</Button>
        </form>
        <div className="rounded-[16px] border border-border bg-surface p-4">
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
          <p className="mt-3 text-sm text-muted">
            Next after findings: Accept → Improvements → export for your coding agent → Mark
            implemented → Mark verified → Generate report.
          </p>
        </div>
      </div>

      <h3 className="mt-6 text-lg font-semibold">Findings</h3>
      {findings.length === 0 ? (
        <EmptyState
          title="No findings yet"
          body="Run automated checks (works without Browser Run), log a founder note, or invite a reviewer."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="rounded-[16px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">{f.title}</h4>
                <StatusPill tone="neutral">{f.provenance.replaceAll("_", " ")}</StatusPill>
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
                {f.state === "observed" || f.state === "triaged" || f.state === "reopened" ? (
                  <>
                    <Button onClick={() => void triage(f, "accepted")}>Accept</Button>
                    <Button variant="ghost" onClick={() => void triage(f, "needs_evidence")}>
                      Need evidence
                    </Button>
                    <Button variant="ghost" onClick={() => void triage(f, "dismissed")}>
                      Dismiss
                    </Button>
                  </>
                ) : null}
                {f.state === "accepted" ? (
                  <Link to={`/app/projects/${id}/changes`}>
                    <Button>Propose improvement</Button>
                  </Link>
                ) : null}
                {(f.state === "accepted" || f.state === "change_proposed") && (
                  <Button variant="secondary" onClick={() => void triage(f, "implemented")}>
                    Mark implemented
                  </Button>
                )}
                {(f.state === "implemented" ||
                  f.state === "verification_pending" ||
                  f.state === "change_proposed") && (
                  <Button variant="secondary" onClick={() => void verify(f)}>
                    Mark verified
                  </Button>
                )}
                {f.state === "verified" ? (
                  <StatusPill tone="positive">Loop step complete</StatusPill>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
