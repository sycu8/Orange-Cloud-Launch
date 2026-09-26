import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Input, Label, Notice, StatusPill } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

type LoopStep = {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
};

function buildLoopSteps(id: string, data: ProjectDetail): LoopStep[] {
  const latest = data.releases[0];
  const loop = data.loop ?? {
    open_missions: 0,
    open_findings: 0,
    accepted_findings: 0,
    in_progress_findings: 0,
    verified_findings: 0,
    change_sets: 0,
    implemented_changes: 0,
    reports: 0,
  };
  return [
    {
      key: "release",
      label: "Capture a frozen release",
      done: Boolean(latest),
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : undefined,
      cta: latest ? "Open latest release" : undefined,
    },
    {
      key: "review",
      label: "Request a focused review",
      done: loop.open_missions > 0 || loop.open_findings + loop.accepted_findings + loop.verified_findings > 0,
      href: `/app/projects/${id}/missions`,
      cta: "Open reviews",
    },
    {
      key: "triage",
      label: "Triage and accept findings",
      done: loop.accepted_findings + loop.in_progress_findings + loop.verified_findings > 0,
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : `/app/projects/${id}/missions`,
      cta: loop.open_findings > 0 ? `Triage ${loop.open_findings} open` : "Open release",
    },
    {
      key: "improve",
      label: "Propose / export an improvement",
      done: loop.change_sets > 0,
      href: `/app/projects/${id}/changes`,
      cta: "Improvement studio",
    },
    {
      key: "verify",
      label: "Mark implemented and verify live",
      done: loop.verified_findings > 0 || loop.implemented_changes > 0,
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : `/app/projects/${id}/changes`,
      cta: "Verify findings",
    },
    {
      key: "report",
      label: "Generate a release report",
      done: loop.reports > 0,
      href: `/app/projects/${id}/reports`,
      cta: loop.reports > 0 ? "View reports" : "Go to reports",
    },
  ];
}

export function ProjectOverviewPage() {
  const { id } = useParams();
  const { data, reload } = useOutletContext<{
    data: ProjectDetail;
    reload: () => Promise<void>;
  }>();
  const [label, setLabel] = useState("Release 1");
  const [sourceUrl, setSourceUrl] = useState(data.project.live_url ?? "");
  const [commitSha, setCommitSha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = data.releases[0];
  const steps = buildLoopSteps(id!, data);
  const nextStep = steps.find((s) => !s.done) ?? steps[steps.length - 1]!;

  async function addRelease(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const rel = await api<{ id: string }>(`/api/projects/${id}/releases`, {
        method: "POST",
        body: JSON.stringify({ label, sourceUrl, commitSha: commitSha || undefined }),
      });
      setMessage(`Release captured. Open it to run checks or create a mission.`);
      await reload();
      void rel;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function runAutomated(releaseId: string) {
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ job: { state: string; result_json?: string } }>(
        `/api/projects/${id}/releases/${releaseId}/runs`,
        { method: "POST", body: "{}" },
      );
      const parsed = result.job.result_json
        ? (JSON.parse(result.job.result_json) as { status?: string; message?: string })
        : null;
      if (parsed?.status === "quota_exceeded") {
        setError(parsed.message ?? "Quota exceeded");
      } else if (parsed?.status === "completed") {
        setMessage(
          `Automated review finished (${result.job.state}). Browser Run may still be not-configured — check findings.`,
        );
      } else {
        setMessage(`Job ${result.job.state}`);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Guided improvement loop</h2>
          <p className="mt-1 text-sm text-muted">
            Next: <span className="font-semibold text-action">{nextStep.label}</span>
          </p>
          <ol className="mt-4 space-y-2">
            {steps.map((step, index) => (
              <li
                key={step.key}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-[12px] border px-3 py-3 ${
                  step.key === nextStep.key
                    ? "border-accent bg-orange-tint"
                    : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-muted">{index + 1}</span>
                  <span className="font-semibold">{step.label}</span>
                  <StatusPill tone={step.done ? "positive" : "neutral"}>
                    {step.done ? "done" : "todo"}
                  </StatusPill>
                </div>
                {step.href && step.cta ? (
                  <Link to={step.href}>
                    <Button variant={step.key === nextStep.key ? "primary" : "ghost"}>
                      {step.cta}
                    </Button>
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Latest release</h2>
          {!latest ? (
            <EmptyState
              title="Add a release to start tracking improvements."
              body="Reviews always point to a frozen release URL and capture time — never an undefined “latest” screen."
            />
          ) : (
            <div className="mt-3 rounded-[16px] border border-border bg-surface p-5">
              <p className="text-sm text-muted">Latest release</p>
              <p className="text-lg font-semibold">{latest.label}</p>
              <p className="truncate text-sm text-muted">{latest.source_url}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/app/projects/${id}/releases/${latest.id}`}>
                  <Button>Open release workspace</Button>
                </Link>
                <Button variant="secondary" onClick={() => void runAutomated(latest.id)}>
                  Run automated review
                </Button>
              </div>
            </div>
          )}
          {message ? (
            <div className="mt-4">
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
      </div>
      <form onSubmit={(e) => void addRelease(e)} className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Capture release</h2>
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div>
          <Label>Source URL</Label>
          <Input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Commit SHA (optional)</Label>
          <Input value={commitSha} onChange={(e) => setCommitSha(e.target.value)} />
        </div>
        <Button type="submit">Freeze snapshot</Button>
      </form>
    </div>
  );
}
