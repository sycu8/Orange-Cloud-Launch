import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { buildPlainFixNote, isConnectedRevision } from "@oclaunch/shared";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, EmptyState, Input, Label, Notice, StatusPill, TextArea } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

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

function stateLabel(state: string, t: (key: string) => string) {
  const key = `changes.state.${state}`;
  const label = t(key);
  return label === key ? state.replaceAll("_", " ") : label;
}

export function ChangeDetailPage() {
  const { id, changeId } = useParams();
  const { t } = useI18n();
  const { data: projectData } = useOutletContext<{ data: ProjectDetail }>();
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [deployedSha, setDeployedSha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await api<{ changeSet: ChangeSet; findings: Finding[] }>(
      `/api/projects/${id}/changes/${changeId}`,
    );
    setChangeSet(res.changeSet);
    setFindings(res.findings);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t("changes.loadFailed")));
  }, [id, changeId]);

  const note = useMemo(() => {
    if (!changeSet) return "";
    return buildPlainFixNote({
      projectName: projectData.project.name,
      purpose: projectData.project.purpose,
      audience: projectData.project.audience,
      liveUrl: projectData.project.live_url,
      baseSha: changeSet.base_sha,
      findings: findings.map((finding) => ({
        title: finding.title,
        body: finding.body,
        acceptanceCriterion: finding.acceptance_criterion,
      })),
    });
  }, [changeSet, findings, projectData.project]);

  async function copyFixNote() {
    setError(null);
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(note);
      setMessage(t("changes.copied"));
    } catch {
      setError(t("changes.copyFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function savePacket() {
    setError(null);
    setBusy("packet");
    try {
      await api(`/api/projects/${id}/changes/${changeId}/export`, {
        method: "POST",
        body: "{}",
      });
      setMessage(t("changes.packetReady"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("changes.loadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function requestBuild() {
    setError(null);
    setBusy("preview");
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/changes/${changeId}/build`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { status?: string })
        : null;
      if (parsed?.status === "integration_not_configured") {
        setError(t("changes.previewBlocked"));
      } else {
        setMessage(t("changes.previewRequested"));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("changes.loadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function markImplemented() {
    setError(null);
    setBusy("live");
    try {
      const version = deployedSha.trim();
      await api(`/api/projects/${id}/changes/${changeId}/mark-implemented`, {
        method: "POST",
        body: JSON.stringify({
          ...(version ? { deployedSha: version } : {}),
          notes: "Owner marked the fix live.",
        }),
      });
      setMessage(t("changes.markedLive"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("changes.loadFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (error && !changeSet) {
    return (
      <Notice title={t("changes.unavailable")} tone="danger">
        {error}
      </Notice>
    );
  }
  if (!changeSet) return <p className="text-muted">{t("changes.loading")}</p>;

  const primaryRelease = findings[0]?.release_id;
  const title = findings[0]?.title?.trim() || t("changes.untitled");

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/app/projects/${id}/changes`} className="text-muted">
          {t("changes.back")}
        </Link>{" "}
        / {title}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("changes.fixTitle")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("changes.fixLead")}</p>
        </div>
        <StatusPill
          tone={
            changeSet.state === "implemented" || changeSet.state === "approved_for_merge"
              ? "positive"
              : changeSet.state === "awaiting_integration"
                ? "neutral"
                : "action"
          }
        >
          {stateLabel(changeSet.state, t)}
        </StatusPill>
      </div>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">{t("changes.whatTitle")}</h3>
        {findings.length === 0 ? (
          <EmptyState title={t("changes.whatEmptyTitle")} body={t("changes.whatEmptyBody")} />
        ) : (
          <ul className="mt-3 space-y-3">
            {findings.map((finding) => (
              <li key={finding.id} className="rounded-[16px] border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{finding.title}</p>
                  <StatusPill tone={finding.state === "verified" ? "positive" : "action"}>
                    {stateLabel(finding.state, t)}
                  </StatusPill>
                </div>
                {finding.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{finding.body}</p>
                ) : null}
                {finding.acceptance_criterion ? (
                  <p className="mt-2 text-sm text-muted">
                    {t("changes.doneWhen")} {finding.acceptance_criterion}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
          <h3 className="font-semibold">{t("changes.handTitle")}</h3>
          <p className="text-sm text-muted">{t("changes.handBody")}</p>
          <Notice title={t("changes.connectTitle")} tone="neutral">
            {t("changes.connectBody")}
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy === "copy" || !note} onClick={() => void copyFixNote()}>
              {t("changes.copyNote")}
            </Button>
            {changeSet.export_artifact_id ? (
              <a href={`/api/projects/${id}/changes/${changeId}/export-download`}>
                <Button variant="ghost">{t("changes.download")}</Button>
              </a>
            ) : (
              <Button variant="ghost" disabled={busy === "packet"} onClick={() => void savePacket()}>
                {t("changes.savePacket")}
              </Button>
            )}
          </div>
          <Label>{t("changes.noteLabel")}</Label>
          <TextArea readOnly rows={12} value={note} aria-label={t("changes.noteLabel")} />
          <p className="text-sm text-muted">{t("changes.noteHint")}</p>
          {changeSet.preview_url || changeSet.pr_url ? (
            <p className="text-sm">
              {changeSet.preview_url ? (
                <a href={changeSet.preview_url}>{t("changes.openPreview")}</a>
              ) : null}
              {changeSet.pr_url ? (
                <>
                  {changeSet.preview_url ? " · " : null}
                  <a href={changeSet.pr_url}>{t("changes.openDraft")}</a>
                </>
              ) : null}
            </p>
          ) : null}
        </section>

        <section className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
          <h3 className="font-semibold">{t("changes.liveTitle")}</h3>
          <p className="text-sm text-muted">{t("changes.liveBody")}</p>
          <Button
            disabled={changeSet.state === "implemented" || busy === "live"}
            onClick={() => void markImplemented()}
          >
            {changeSet.state === "implemented" ? t("changes.alreadyLive") : t("changes.markLive")}
          </Button>
          {primaryRelease ? (
            <Link to={`/app/projects/${id}/releases/${primaryRelease}`} className="block">
              <Button variant="secondary">{t("changes.checkRelease")}</Button>
            </Link>
          ) : null}
          <details className="rounded-[16px] border border-border p-4">
            <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
              {t("changes.versionAdd")}
            </summary>
            <p className="mt-2 text-sm text-muted">{t("changes.versionAddHelp")}</p>
            <div className="mt-3">
              <Input
                value={deployedSha}
                onChange={(e) => setDeployedSha(e.target.value)}
                placeholder={t("changes.versionPh")}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </details>
        </section>
      </div>

      <details className="mt-6 rounded-[16px] border border-border bg-surface p-4">
        <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
          {t("changes.tech")}
        </summary>
        <div className="mt-3 space-y-3 text-sm text-muted">
          <p>{t("changes.techBody")}</p>
          <p>
            {isConnectedRevision(changeSet.base_sha)
              ? `${t("changes.versionPrefix")} ${changeSet.base_sha}`
              : t("changes.unconnected")}
          </p>
          <p className="break-all">
            {t("changes.recordId")} {changeSet.id}
          </p>
          <Button variant="ghost" disabled={busy === "preview"} onClick={() => void requestBuild()}>
            {t("changes.requestPreview")}
          </Button>
        </div>
      </details>

      {message ? (
        <div className="mt-6">
          <Notice title={t("common.update")} tone="positive">
            {message}
          </Notice>
        </div>
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
