import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, EmptyState, Input, Label, Notice, StatusPill } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

type LoopStep = {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
};

function buildLoopSteps(
  id: string,
  data: ProjectDetail,
  t: (key: string) => string,
): LoopStep[] {
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
      label: t("overview.step.release"),
      done: Boolean(latest),
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : undefined,
      cta: latest ? t("overview.cta.openLatest") : undefined,
    },
    {
      key: "review",
      label: t("overview.step.review"),
      done:
        loop.open_missions > 0 ||
        loop.open_findings +
          loop.accepted_findings +
          loop.in_progress_findings +
          loop.verified_findings >
          0,
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : `/app/projects/${id}/missions`,
      cta: latest ? t("overview.cta.openRelease") : t("overview.cta.openReviews"),
    },
    {
      key: "triage",
      label: t("overview.step.triage"),
      done: loop.accepted_findings + loop.in_progress_findings + loop.verified_findings > 0,
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : `/app/projects/${id}/missions`,
      cta:
        loop.open_findings > 0
          ? `${t("overview.cta.triageOpen")} ${loop.open_findings}`
          : t("overview.cta.openRelease"),
    },
    {
      key: "improve",
      label: t("overview.step.improve"),
      done: loop.change_sets > 0,
      href: `/app/projects/${id}/changes`,
      cta: t("overview.cta.studio"),
    },
    {
      key: "verify",
      label: t("overview.step.verify"),
      done: loop.verified_findings > 0,
      href: latest ? `/app/projects/${id}/releases/${latest.id}` : `/app/projects/${id}/changes`,
      cta:
        loop.implemented_changes > 0
          ? t("overview.cta.verifyRelease")
          : t("overview.cta.verifyFindings"),
    },
    {
      key: "report",
      label: t("overview.step.report"),
      done: loop.reports > 0,
      href: `/app/projects/${id}/reports`,
      cta: loop.reports > 0 ? t("overview.cta.viewReports") : t("overview.cta.goReports"),
    },
  ];
}

export function ProjectOverviewPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, reload } = useOutletContext<{
    data: ProjectDetail;
    reload: () => Promise<void>;
  }>();
  const [label, setLabel] = useState("Release 1");
  const [sourceUrl, setSourceUrl] = useState(data.project.live_url ?? "");
  const [reviewedUrl, setReviewedUrl] = useState(data.project.live_url ?? "");
  const [environment, setEnvironment] = useState<"localhost" | "preview" | "production">(
    "preview",
  );
  const [commitSha, setCommitSha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = data.releases[0];
  const steps = buildLoopSteps(id!, data, t);
  const nextStep = steps.find((s) => !s.done) ?? steps[steps.length - 1]!;

  async function addRelease(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const rel = await api<{ id: string; defaultMissions?: number }>(
        `/api/projects/${id}/releases`,
        {
          method: "POST",
          body: JSON.stringify({
            label,
            sourceUrl,
            reviewedUrl: reviewedUrl || sourceUrl,
            environment,
            commitSha: commitSha || undefined,
          }),
        },
      );
      setMessage(
        `Release captured with ${rel.defaultMissions ?? 5} dangerous-path missions. Invite reviewers — could not complete is a real review.`,
      );
      await reload();
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
        ? (JSON.parse(result.job.result_json) as {
            status?: string;
            message?: string;
            browser?: { status?: string; captureCount?: number; message?: string };
          })
        : null;
      if (parsed?.status === "quota_exceeded") {
        setError(parsed.message ?? "Quota exceeded");
      } else if (parsed?.status === "completed") {
        const browserStatus = parsed.browser?.status;
        if (browserStatus === "completed" && (parsed.browser?.captureCount ?? 0) > 0) {
          setMessage(
            `Automated review finished. Browser Run human-tester saved ${parsed.browser?.captureCount} viewport snapshot(s). Human reviews still count separately.`,
          );
        } else if (browserStatus === "integration_not_configured") {
          setMessage(
            `Automated review finished (${result.job.state}). Browser Run is not configured — deterministic notes only; not human outcomes.`,
          );
        } else {
          setMessage(
            `Automated review finished (${result.job.state}). ${parsed.browser?.message ?? "Check findings."}`,
          );
        }
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
          <h2 className="text-xl font-semibold">{t("overview.guided")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("common.next")}:{" "}
            <span className="font-semibold text-action">{nextStep.label}</span>
            {" — "}
            {t("overview.nextSolo")}
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
                    {step.done ? t("common.done") : t("common.todo")}
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
          <h2 className="text-xl font-semibold">{t("overview.latest")}</h2>
          {!latest ? (
            <EmptyState
              title={t("overview.emptyReleaseTitle")}
              body={t("overview.emptyReleaseBody")}
            />
          ) : (
            <div className="mt-3 rounded-[16px] border border-border bg-surface p-5">
              <p className="text-sm text-muted">{t("overview.latest")}</p>
              <p className="text-lg font-semibold">{latest.label}</p>
              <p className="truncate text-sm text-muted">{latest.source_url}</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {t("overview.triedOn")} {latest.environment ?? "preview"}
                {latest.reviewed_url ? ` · ${latest.reviewed_url}` : ""}
                {latest.commit_sha ? ` · ${latest.commit_sha}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/app/projects/${id}/releases/${latest.id}`}>
                  <Button>{t("overview.openWorkspace")}</Button>
                </Link>
                <Link to={`/app/projects/${id}/missions`}>
                  <Button variant="secondary">{t("overview.shareMissions")}</Button>
                </Link>
                <Button variant="ghost" onClick={() => void runAutomated(latest.id)}>
                  {t("overview.runAutomated")}
                </Button>
              </div>
            </div>
          )}
          {message ? (
            <div className="mt-4">
              <Notice title={t("common.update")} tone="positive">
                {message}
              </Notice>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Notice title={t("overview.blocked")} tone="danger">
                {error}
              </Notice>
            </div>
          ) : null}
        </div>
      </div>
      <form
        onSubmit={(e) => void addRelease(e)}
        className="space-y-3 rounded-[16px] border border-border bg-surface p-5"
      >
        <h2 className="text-lg font-semibold">{t("overview.capture")}</h2>
        <p className="text-sm text-muted">{t("overview.captureBody")}</p>
        <div>
          <Label>{t("overview.label")}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div>
          <Label>{t("overview.sourceUrl")}</Label>
          <Input
            type="url"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
              if (!reviewedUrl || reviewedUrl === sourceUrl) setReviewedUrl(e.target.value);
            }}
            required
          />
        </div>
        <div>
          <Label>{t("overview.whereTry")}</Label>
          <select
            className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
            value={environment}
            onChange={(e) =>
              setEnvironment(e.target.value as "localhost" | "preview" | "production")
            }
          >
            <option value="localhost">localhost</option>
            <option value="preview">preview</option>
            <option value="production">production</option>
          </select>
        </div>
        <div>
          <Label>{t("overview.urlOpen")}</Label>
          <Input
            type="url"
            value={reviewedUrl}
            onChange={(e) => setReviewedUrl(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>{t("overview.commit")}</Label>
          <Input value={commitSha} onChange={(e) => setCommitSha(e.target.value)} />
        </div>
        <Button type="submit">{t("overview.freeze")}</Button>
      </form>
    </div>
  );
}
