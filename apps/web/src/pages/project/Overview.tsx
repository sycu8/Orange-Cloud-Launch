import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n, useLabel } from "../../lib/i18n";
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
  const labelText = useLabel();
  const [label, setLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState(data.project.live_url ?? "");
  const [reviewedUrl, setReviewedUrl] = useState("");
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
      await api(`/api/projects/${id}/releases`, {
        method: "POST",
        body: JSON.stringify({
          label,
          sourceUrl,
          reviewedUrl: reviewedUrl.trim() || sourceUrl,
          environment,
          commitSha: commitSha || undefined,
        }),
      });
      setMessage(t("overview.saved"));
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
        setError(t("overview.checkQuota"));
      } else if (parsed?.browser?.status === "completed" && (parsed.browser?.captureCount ?? 0) > 0) {
        setMessage(t("overview.checkPictures"));
      } else {
        setMessage(t("overview.checkDone"));
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const captureForm = (
    <form
      onSubmit={(e) => void addRelease(e)}
      className="space-y-3 rounded-[16px] border border-border bg-surface p-5"
    >
      <h2 className="text-lg font-semibold">
        {latest ? t("overview.captureAgain") : t("overview.capture")}
      </h2>
      <p className="text-sm text-muted">{t("overview.captureBody")}</p>
      <div>
        <Label>{t("overview.label")}</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("overview.labelPh")}
          required
        />
      </div>
      <div>
        <Label>{t("overview.sourceUrl")}</Label>
        <Input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://"
          required
        />
      </div>
      <div>
        <Label>{t("overview.whereTry")}</Label>
        <select
          className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3 text-base"
          value={environment}
          onChange={(e) =>
            setEnvironment(e.target.value as "localhost" | "preview" | "production")
          }
        >
          <option value="preview">{t("label.env.preview")}</option>
          <option value="production">{t("label.env.production")}</option>
          <option value="localhost">{t("label.env.localhost")}</option>
        </select>
      </div>
      <details className="rounded-[12px] border border-border p-3">
        <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
          {t("overview.commit")}
        </summary>
        <p className="mt-2 text-sm text-muted">{t("overview.commitHelp")}</p>
        <div className="mt-3">
          <Label>{t("overview.urlOpen")}</Label>
          <Input
            type="url"
            value={reviewedUrl}
            onChange={(e) => setReviewedUrl(e.target.value)}
            placeholder={sourceUrl || "https://"}
          />
        </div>
        <div className="mt-3">
          <Input
            value={commitSha}
            onChange={(e) => setCommitSha(e.target.value)}
            placeholder={t("changes.versionPh")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </details>
      <Button type="submit" className="w-full sm:w-auto">
        {t("overview.freeze")}
      </Button>
    </form>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      {!latest ? <div className="lg:col-span-2">{captureForm}</div> : null}
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
                className={`flex flex-col gap-2 rounded-[12px] border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${
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
                  <Link to={step.href} className="w-full sm:w-auto">
                    <Button
                      className="w-full sm:w-auto"
                      variant={step.key === nextStep.key ? "primary" : "ghost"}
                    >
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
              <p className="break-all text-sm text-muted">{latest.source_url}</p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {t("overview.triedOn")} {labelText("env", latest.environment ?? "preview")}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link to={`/app/projects/${id}/releases/${latest.id}`} className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">{t("overview.openWorkspace")}</Button>
                </Link>
                <Link to={`/app/projects/${id}/missions`} className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    {t("overview.shareMissions")}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => void runAutomated(latest.id)}
                >
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
      {latest ? captureForm : null}
    </div>
  );
}
