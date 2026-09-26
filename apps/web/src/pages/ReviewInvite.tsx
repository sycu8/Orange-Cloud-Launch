import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { PinEvidence, type ReviewPin } from "../components/PinEvidence";
import { Button, Label, Notice, TextArea, PageHeader } from "../components/ui";

export function ReviewInvitePage() {
  const { token } = useParams();
  const { me } = useAuth();
  const { t } = useI18n();
  const [mission, setMission] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pins, setPins] = useState<ReviewPin[]>([]);
  const [form, setForm] = useState({
    audienceFit: "target_user",
    outcome: "could_not_complete",
    tried: "",
    expected: "",
    stuck: "",
    observations: "",
  });

  useEffect(() => {
    api<{ mission: Record<string, unknown> }>(`/api/invite/${token}`)
      .then((d) => setMission(d.mission))
      .catch((e) => setError(e instanceof Error ? e.message : "Invite unavailable"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/invite/${token}/reviews`, {
        method: "POST",
        body: JSON.stringify({ ...form, pins }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  if (error && !mission) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Notice title={t("invite.unavailable")} tone="danger">
          {error}
        </Notice>
      </div>
    );
  }
  if (!mission) return <p className="p-8 text-muted">{t("invite.loading")}</p>;

  const isOwner = Boolean(mission.isOwner);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title={String(mission.title)}
        subtitle={`${String(mission.projectName)} · ${String(mission.releaseLabel)}`}
      />
      <Notice title={t("invite.instructions")} tone="action">
        {String(mission.instructions)}
      </Notice>
      <div className="mt-4">
        <a href={String(mission.sourceUrl || mission.liveUrl)} target="_blank" rel="noreferrer">
          <Button variant="secondary">{t("invite.openTarget")}</Button>
        </a>
      </div>
      {!me ? (
        <div className="mt-6">
          <Notice title={t("invite.signInTitle")} tone="neutral">
            <Link to={`/signin?next=/review/${token}`}>{t("nav.signIn")}</Link>.{" "}
            {t("invite.signInBody")}
          </Notice>
        </div>
      ) : isOwner ? (
        <div className="mt-6">
          <Notice title={t("invite.selfBlockedTitle")} tone="action">
            {t("invite.selfBlockedBody")}
          </Notice>
        </div>
      ) : done ? (
        <div className="mt-6">
          <Notice title={t("invite.submittedTitle")} tone="positive">
            {t("invite.submittedBody")}
          </Notice>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <p className="font-semibold">{t("invite.prompt")}</p>
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
            <TextArea
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
            uploadUrl={`/api/invite/${token}/evidence`}
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
          {error ? (
            <Notice title={t("invite.submitError")} tone="danger">
              {error}
            </Notice>
          ) : null}
          <Button type="submit">{t("inbox.submit")}</Button>
        </form>
      )}
    </div>
  );
}
