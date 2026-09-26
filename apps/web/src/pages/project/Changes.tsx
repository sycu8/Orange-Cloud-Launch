import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isConnectedRevision } from "@oclaunch/shared";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, EmptyState, Input, Notice, StatusPill } from "../../components/ui";

type ChangeSet = {
  id: string;
  base_sha: string;
  state: string;
  created_at?: string;
  lead_title?: string | null;
  finding_count?: number;
};

type Finding = { id: string; title: string; state: string; release_id: string };

function stateLabel(state: string, t: (key: string) => string) {
  const key = `changes.state.${state}`;
  const label = t(key);
  return label === key ? state.replaceAll("_", " ") : label;
}

function stateTone(state: string): "neutral" | "action" | "positive" {
  if (state === "implemented" || state === "approved_for_merge") return "positive";
  if (state === "awaiting_integration") return "neutral";
  return "action";
}

export function ChangesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [changeSets, setChangeSets] = useState<ChangeSet[]>([]);
  const [accepted, setAccepted] = useState<Finding[]>([]);
  const [latestReleaseId, setLatestReleaseId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [baseSha, setBaseSha] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const cs = await api<{ changeSets: ChangeSet[] }>(`/api/projects/${id}/changes`);
    setChangeSets(cs.changeSets);
    const project = await api<{ releases: Array<{ id: string }> }>(`/api/projects/${id}`);
    setLatestReleaseId(project.releases[0]?.id ?? null);
    const findings: Finding[] = [];
    for (const rel of project.releases.slice(0, 5)) {
      const detail = await api<{ findings: Finding[] }>(
        `/api/projects/${id}/releases/${rel.id}`,
      );
      findings.push(
        ...detail.findings.filter(
          (f) => f.state === "accepted" || f.state === "change_proposed",
        ),
      );
    }
    setAccepted(findings.filter((f) => f.state === "accepted"));
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t("changes.loadFailed")));
  }, [id]);

  async function createChangeSet() {
    const version = baseSha.trim();
    if (version && version.length < 7) {
      setError(t("changes.baseShaError"));
      return;
    }
    setError(null);
    try {
      const res = await api<{ id: string }>(`/api/projects/${id}/changes`, {
        method: "POST",
        body: JSON.stringify({
          findingIds: selected,
          ...(version ? { baseSha: version } : {}),
        }),
      });
      setSelected([]);
      setBaseSha("");
      navigate(`/app/projects/${id}/changes/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("changes.loadFailed"));
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div>
        <h2 className="text-xl font-semibold">{t("changes.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("changes.subtitle")}</p>
        <ol className="mt-4 space-y-2 text-sm text-ink">
          <li>{t("changes.step1")}</li>
          <li>{t("changes.step2")}</li>
          <li>{t("changes.step3")}</li>
        </ol>

        <h3 className="mt-6 font-semibold">{t("changes.choose")}</h3>
        {accepted.length === 0 ? (
          <EmptyState
            title={t("changes.acceptedEmptyTitle")}
            body={t("changes.acceptedEmptyBody")}
            action={
              latestReleaseId ? (
                <Link to={`/app/projects/${id}/releases/${latestReleaseId}`}>
                  <Button>{t("changes.goRelease")}</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-2 space-y-2">
            {accepted.map((f) => (
              <li key={f.id} className="rounded-[16px] border border-border bg-surface p-3">
                <label className="flex min-h-[44px] items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={selected.includes(f.id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id),
                      )
                    }
                  />
                  <span>{f.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 rounded-[16px] border border-border bg-surface p-4">
          <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
            {t("changes.versionOptional")}
          </summary>
          <p className="mt-2 text-sm text-muted">{t("changes.versionHelp")}</p>
          <div className="mt-3">
            <Input
              value={baseSha}
              onChange={(e) => setBaseSha(e.target.value)}
              placeholder={t("changes.versionPh")}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </details>

        <Button className="mt-4" disabled={!selected.length} onClick={() => void createChangeSet()}>
          {t("changes.start")}
        </Button>
        {!selected.length ? (
          <p className="mt-2 text-sm text-muted">{t("changes.chooseHint")}</p>
        ) : null}
        {error ? (
          <div className="mt-4">
            <Notice title={t("common.error")} tone="danger">
              {error}
            </Notice>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="font-semibold">{t("changes.listTitle")}</h3>
        {changeSets.length === 0 ? (
          <EmptyState title={t("changes.setsEmptyTitle")} body={t("changes.setsEmptyBody")} />
        ) : (
          <ul className="mt-3 space-y-3">
            {changeSets.map((cs) => {
              const count = cs.finding_count ?? 0;
              const created = cs.created_at ? new Date(cs.created_at) : null;
              const when =
                created && !Number.isNaN(created.getTime())
                  ? created.toLocaleDateString(lang === "vi" ? "vi" : "en", {
                      month: "short",
                      day: "numeric",
                    })
                  : "";
              return (
                <li key={cs.id} className="rounded-[16px] border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{cs.lead_title?.trim() || t("changes.untitled")}</p>
                    <StatusPill tone={stateTone(cs.state)}>{stateLabel(cs.state, t)}</StatusPill>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {count} {count === 1 ? t("changes.problem") : t("changes.problems")}
                    {when ? ` · ${when}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {isConnectedRevision(cs.base_sha)
                      ? `${t("changes.versionPrefix")} ${cs.base_sha.slice(0, 7)}`
                      : t("changes.unconnected")}
                  </p>
                  <div className="mt-3">
                    <Link to={`/app/projects/${id}/changes/${cs.id}`}>
                      <Button>{t("changes.continue")}</Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
