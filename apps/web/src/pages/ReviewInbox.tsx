import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { PinEvidence, type ReviewPin } from "../components/PinEvidence";
import { Button, EmptyState, Input, Label, Notice, PageHeader, TextArea } from "../components/ui";

type InboxMission = {
  missionId: string;
  title: string;
  instructions: string;
  projectName: string;
  slug: string;
  audience: string;
  sourceUrl: string;
  releaseLabel: string;
  passportPath: string;
  topicTags: string[];
};

export function ReviewInboxPage() {
  const { me, loading } = useAuth();
  const { t } = useI18n();
  const [missions, setMissions] = useState<InboxMission[]>([]);
  const [active, setActive] = useState<InboxMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pins, setPins] = useState<ReviewPin[]>([]);
  const [form, setForm] = useState({
    audienceFit: "peer",
    outcome: "could_not_complete",
    tried: "",
    expected: "",
    stuck: "",
    observations: "",
  });

  async function load() {
    const res = await api<{ missions: InboxMission[] }>("/api/review-inbox");
    setMissions(res.missions);
  }

  useEffect(() => {
    if (!me) return;
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [me]);

  if (loading) return <p className="text-muted">{t("common.loading")}</p>;
  if (!me) return <Navigate to="/signin?next=/app/inbox" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setError(null);
    try {
      await api(`/api/missions/${active.missionId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ ...form, pins }),
      });
      setDone(active.missionId);
      setActive(null);
      setPins([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <div>
      <PageHeader title={t("inbox.title")} subtitle={t("inbox.subtitle")} />
      {done ? (
        <div className="mb-4">
          <Notice title={t("inbox.submitted")} tone="positive">
            {t("inbox.submittedBody")}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4">
          <Notice title={t("common.error")} tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
      {missions.length === 0 && !active ? (
        <EmptyState
          title={t("inbox.emptyTitle")}
          body={t("inbox.emptyBody")}
          action={
            <Link to="/discover">
              <Button variant="secondary">{t("inbox.browseDiscover")}</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {missions.map((m) => (
            <li key={m.missionId} className="rounded-[16px] border border-border bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-muted">{m.projectName}</p>
                  <h2 className="text-lg font-semibold">{m.title}</h2>
                  <p className="mt-1 text-sm text-muted">{m.instructions}</p>
                  <p className="mt-2 text-xs text-muted">
                    {m.releaseLabel} · {t("inbox.audience")} {m.audience}
                    {m.topicTags?.length ? ` · ${m.topicTags.join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <a href={m.sourceUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="w-full sm:w-auto">
                      {t("inbox.openApp")}
                    </Button>
                  </a>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setActive(m);
                      setPins([]);
                    }}
                  >
                    {t("inbox.submit")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active ? (
        <form
          onSubmit={(e) => void submit(e)}
          className="mt-6 space-y-3 rounded-[16px] border border-border bg-surface p-4 sm:p-5"
        >
          <h3 className="font-semibold">
            {t("inbox.reviewHeading")}: {active.title}
          </h3>
          <div>
            <Label>{t("inbox.tried")}</Label>
            <TextArea
              required
              value={form.tried}
              onChange={(e) => setForm((f) => ({ ...f, tried: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("inbox.expected")}</Label>
            <TextArea
              required
              value={form.expected}
              onChange={(e) => setForm((f) => ({ ...f, expected: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("inbox.stuck")}</Label>
            <Input
              value={form.stuck}
              onChange={(e) => setForm((f) => ({ ...f, stuck: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("inbox.observations")}</Label>
            <TextArea
              required
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
            />
          </div>
          <PinEvidence
            uploadUrl={`/api/missions/${active.missionId}/evidence`}
            pins={pins}
            onChange={setPins}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("inbox.audienceFit")}</Label>
              <select
                className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
                value={form.audienceFit}
                onChange={(e) => setForm((f) => ({ ...f, audienceFit: e.target.value }))}
              >
                <option value="target_user">{t("inbox.fit.target")}</option>
                <option value="peer">{t("inbox.fit.peer")}</option>
                <option value="unknown">{t("inbox.fit.unknown")}</option>
              </select>
            </div>
            <div>
              <Label>{t("inbox.outcome")}</Label>
              <select
                className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
              >
                <option value="completed">{t("inbox.out.completed")}</option>
                <option value="with_help">{t("inbox.out.withHelp")}</option>
                <option value="could_not_complete">{t("inbox.out.couldNot")}</option>
                <option value="not_attempted">{t("inbox.out.notAttempted")}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t("inbox.submit")}</Button>
            <Button type="button" variant="ghost" onClick={() => setActive(null)}>
              {t("inbox.cancel")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
