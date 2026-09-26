import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Input, Label, Notice, StatusPill } from "../../components/ui";

type Finding = {
  id: string;
  title: string;
  state: string;
  category: string;
  severity: string;
  provenance: string;
  acceptance_criterion: string | null;
  release_id: string;
  body: string;
};

type ChangeSet = {
  id: string;
  base_sha: string;
  head_sha: string | null;
  state: string;
  export_artifact_id: string | null;
  preview_url: string | null;
  pr_url: string | null;
  approved_sha: string | null;
};

export function ChangeDetailPage() {
  const { id, changeId } = useParams();
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [deployedSha, setDeployedSha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api<{ changeSet: ChangeSet; findings: Finding[] }>(
      `/api/projects/${id}/changes/${changeId}`,
    );
    setChangeSet(res.changeSet);
    setFindings(res.findings);
    if (res.changeSet.head_sha) setDeployedSha(res.changeSet.head_sha);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id, changeId]);

  async function exportBundle() {
    setError(null);
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/changes/${changeId}/export`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { artifactId?: string })
        : null;
      setMessage(
        parsed?.artifactId
          ? "Agent export ready — download the task bundle and apply it in your coding agent."
          : "Export job finished",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function requestBuild() {
    setError(null);
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/changes/${changeId}/build`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { status?: string; message?: string })
        : null;
      if (parsed?.status === "integration_not_configured") {
        setError(
          parsed.message ??
            "Sandbox + GitHub draft PR is not configured. Use agent export, then mark implemented after you ship.",
        );
      } else {
        setMessage("Build requested");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function markImplemented() {
    setError(null);
    try {
      const res = await api<{ nextAction?: string }>(
        `/api/projects/${id}/changes/${changeId}/mark-implemented`,
        {
          method: "POST",
          body: JSON.stringify({
            deployedSha: deployedSha || undefined,
            notes: "Owner marked shipped after applying agent export or external PR.",
          }),
        },
      );
      setMessage(res.nextAction ?? "Marked implemented");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (error && !changeSet) {
    return (
      <Notice title="Change set unavailable" tone="danger">
        {error}
      </Notice>
    );
  }
  if (!changeSet) return <p className="text-muted">Loading change set…</p>;

  const primaryRelease = findings[0]?.release_id;

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/app/projects/${id}/changes`} className="text-muted">
          Improvements
        </Link>{" "}
        / {changeSet.id}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Change studio</h2>
          <p className="mt-1 text-sm text-muted">
            Base {changeSet.base_sha}
            {changeSet.head_sha ? ` · head ${changeSet.head_sha}` : ""}
          </p>
        </div>
        <StatusPill
          tone={
            changeSet.state === "implemented"
              ? "positive"
              : changeSet.state === "awaiting_integration"
                ? "neutral"
                : "action"
          }
        >
          {changeSet.state.replaceAll("_", " ")}
        </StatusPill>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold">Path 1 — coding agent</h3>
          <p className="text-sm text-muted">
            Export accepted findings, brand tokens, and acceptance criteria. Do not invent filenames
            from a URL-only scan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void exportBundle()}>Export for coding agent</Button>
            {changeSet.export_artifact_id ? (
              <a href={`/api/projects/${id}/changes/${changeId}/export-download`}>
                <Button variant="secondary">Download bundle</Button>
              </a>
            ) : null}
          </div>

          <h3 className="pt-4 font-semibold">Path 2 — sandbox preview / draft PR</h3>
          <Notice title="Integration not configured" tone="neutral">
            Cloudflare Sandbox + GitHub App credentials are required. Until then this path stays
            honest as integration_not_configured.
          </Notice>
          <Button variant="secondary" onClick={() => void requestBuild()}>
            Request preview / draft PR
          </Button>
          {changeSet.preview_url || changeSet.pr_url ? (
            <p className="text-sm">
              {changeSet.preview_url ? (
                <a href={changeSet.preview_url}>Preview</a>
              ) : null}
              {changeSet.pr_url ? (
                <>
                  {" "}
                  · <a href={changeSet.pr_url}>Draft PR</a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
          <h3 className="font-semibold">Close the loop</h3>
          <p className="text-sm text-muted">
            After you ship the improvement in your own repo (or merge externally), mark it
            implemented, then verify against the live release revision.
          </p>
          <div>
            <Label>Deployed commit SHA (optional)</Label>
            <Input
              value={deployedSha}
              onChange={(e) => setDeployedSha(e.target.value)}
              placeholder="sha after deploy"
            />
          </div>
          <Button
            disabled={changeSet.state === "implemented"}
            onClick={() => void markImplemented()}
          >
            {changeSet.state === "implemented" ? "Already implemented" : "Mark implemented"}
          </Button>
          {primaryRelease ? (
            <Link to={`/app/projects/${id}/releases/${primaryRelease}`}>
              <Button variant="secondary" className="mt-2 w-full sm:w-auto">
                Verify on release
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <h3 className="mt-8 text-lg font-semibold">Included findings</h3>
      {findings.length === 0 ? (
        <EmptyState title="No findings linked" body="This change set has no findings." />
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
              {f.acceptance_criterion ? (
                <p className="mt-2 text-sm text-muted">Criterion: {f.acceptance_criterion}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {message ? (
        <div className="mt-6">
          <Notice title="Update" tone="positive">
            {message}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice title="Action blocked" tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
