import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n, useLabel } from "../../lib/i18n";
import { Button, EmptyState, Input, Label, Notice, TextArea } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

type Mission = {
  id: string;
  title: string;
  instructions: string;
  state: string;
  release_id: string;
  created_at: string;
};

export function MissionsPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const label = useLabel();
  const { data } = useOutletContext<{ data: ProjectDetail }>();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [title, setTitle] = useState(data.project.primary_task || t("missions.defaultTitle"));
  const [instructions, setInstructions] = useState(
    data.project.primary_task || t("missions.defaultTitle"),
  );
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const releaseId = data.releases[0]?.id;
  const latest = data.releases[0];

  async function load() {
    const res = await api<{ missions: Mission[] }>(`/api/projects/${id}/missions`);
    setMissions(res.missions);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function share(url: string) {
    setInvite(url);
    setCopied(false);
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(t("missions.copyFailed"));
    }
  }

  async function createMission(e: React.FormEvent) {
    e.preventDefault();
    if (!releaseId) {
      setError(t("missions.needVersion"));
      return;
    }
    try {
      const res = await api<{ inviteToken: string }>(
        `/api/projects/${id}/releases/${releaseId}/missions`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            instructions,
            topicTags: ["first-use"],
            language: "en",
            state: "open",
          }),
        },
      );
      await share(`${window.location.origin}/review/${res.inviteToken}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function rotateInvite(missionId: string) {
    setError(null);
    try {
      const res = await api<{ inviteToken: string }>(
        `/api/projects/${id}/missions/${missionId}/rotate-invite`,
        { method: "POST", body: "{}" },
      );
      await share(`${window.location.origin}/review/${res.inviteToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold">{t("missions.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("missions.lead")}</p>
        <details className="mt-3 rounded-[16px] border border-border bg-surface p-4">
          <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
            {t("missions.prepared")}
          </summary>
          <p className="mt-2 text-sm text-muted">{t("missions.preparedBody")}</p>
        </details>
        {latest ? (
          <div className="mt-3">
            <Link to={`/app/projects/${id}/releases/${latest.id}`} className="inline-block w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                {t("missions.logNote")} {latest.label}
              </Button>
            </Link>
          </div>
        ) : null}
        {missions.length === 0 ? (
          <div className="mt-4">
            <EmptyState title={t("missions.emptyTitle")} body={t("missions.emptyBody")} />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {missions.map((mission) => (
              <li key={mission.id} className="rounded-[16px] border border-border bg-surface p-4">
                <p className="font-semibold">{mission.title}</p>
                <p className="mt-1 text-sm text-muted">{mission.instructions}</p>
                <p className="mt-2 text-sm text-muted">
                  {label("mission", mission.state)}
                  {data.releases.find((release) => release.id === mission.release_id)
                    ? ` · ${data.releases.find((release) => release.id === mission.release_id)!.label}`
                    : ""}
                </p>
                {mission.state === "open" ? (
                  <Button
                    className="mt-3 w-full sm:w-auto"
                    variant="secondary"
                    onClick={() => void rotateInvite(mission.id)}
                  >
                    {t("missions.newLink")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        onSubmit={(e) => void createMission(e)}
        className="space-y-3 rounded-[16px] border border-border bg-surface p-5"
      >
        <h3 className="font-semibold">{t("missions.formTitle")}</h3>
        <div>
          <Label>{t("missions.titleField")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label>{t("missions.instructions")}</Label>
          <TextArea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={!releaseId}>
          {t("missions.create")}
        </Button>
        {invite ? (
          <Notice title={t("missions.shareTitle")} tone="action">
            <p>{copied ? t("missions.copied") : t("missions.shareBody")}</p>
            <Input className="mt-2" readOnly value={invite} onFocus={(e) => e.currentTarget.select()} />
            <Button className="mt-2 w-full sm:w-auto" variant="secondary" onClick={() => void share(invite)}>
              {t("missions.copyLink")}
            </Button>
          </Notice>
        ) : null}
        {error ? (
          <Notice title={t("common.error")} tone="danger">
            {error}
          </Notice>
        ) : null}
      </form>
    </div>
  );
}
