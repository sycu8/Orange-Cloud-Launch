import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, EmptyState, Input, Label, Notice } from "../../components/ui";

type ChangeSet = {
  id: string;
  base_sha: string;
  state: string;
  export_artifact_id: string | null;
};

type Finding = { id: string; title: string; state: string; release_id: string };

export function ChangesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [changeSets, setChangeSets] = useState<ChangeSet[]>([]);
  const [accepted, setAccepted] = useState<Finding[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [baseSha, setBaseSha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const cs = await api<{ changeSets: ChangeSet[] }>(`/api/projects/${id}/changes`);
    setChangeSets(cs.changeSets);
    const project = await api<{ releases: Array<{ id: string }> }>(`/api/projects/${id}`);
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
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function createChangeSet() {
    if (baseSha.trim().length < 7) {
      setError(t("changes.baseShaError"));
      return;
    }
    try {
      const res = await api<{ id: string }>(`/api/projects/${id}/changes`, {
        method: "POST",
        body: JSON.stringify({ findingIds: selected, baseSha: baseSha.trim() }),
      });
      setMessage(`Change set ${res.id} proposed`);
      setSelected([]);
      await load();
      navigate(`/app/projects/${id}/changes/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function exportBundle(changeId: string) {
    try {
      await api(`/api/projects/${id}/changes/${changeId}/export`, {
        method: "POST",
        body: "{}",
      });
      setMessage(t("changes.exportReady"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold">{t("changes.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("changes.subtitle")}</p>
        <div className="mt-4 space-y-2">
          <Label>{t("changes.baseSha")}</Label>
          <Input
            value={baseSha}
            onChange={(e) => setBaseSha(e.target.value)}
            placeholder={t("changes.baseShaPh")}
            required
          />
        </div>
        <h3 className="mt-4 font-semibold">{t("changes.accepted")}</h3>
        {accepted.length === 0 ? (
          <EmptyState
            title={t("changes.acceptedEmptyTitle")}
            body={t("changes.acceptedEmptyBody")}
          />
        ) : (
          <ul className="mt-2 space-y-2">
            {accepted.map((f) => (
              <li key={f.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
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
        <Button
          className="mt-4"
          disabled={!selected.length || baseSha.trim().length < 7}
          onClick={() => void createChangeSet()}
        >
          {t("changes.propose")}
        </Button>
      </div>
      <div>
        <h3 className="font-semibold">{t("changes.sets")}</h3>
        {changeSets.length === 0 ? (
          <EmptyState title={t("changes.setsEmptyTitle")} body={t("changes.setsEmptyBody")} />
        ) : (
          <ul className="mt-3 space-y-3">
            {changeSets.map((cs) => (
              <li key={cs.id} className="rounded-[16px] border border-border bg-surface p-4">
                <p className="font-semibold">{cs.id}</p>
                <p className="text-sm text-muted">
                  {cs.state} · base {cs.base_sha}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/app/projects/${id}/changes/${cs.id}`}>
                    <Button>{t("changes.openStudio")}</Button>
                  </Link>
                  <Button variant="ghost" onClick={() => void exportBundle(cs.id)}>
                    {t("changes.quickExport")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
            <Notice title={t("common.error")} tone="danger">
              {error}
            </Notice>
          </div>
        ) : null}
      </div>
    </div>
  );
}
