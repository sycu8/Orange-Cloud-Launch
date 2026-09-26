import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PinEvidence, type ReviewPin } from "../components/PinEvidence";
import { Button, Label, Notice, TextArea, PageHeader } from "../components/ui";

export function ReviewInvitePage() {
  const { token } = useParams();
  const { me } = useAuth();
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
        <Notice title="Invite unavailable" tone="danger">
          {error}
        </Notice>
      </div>
    );
  }
  if (!mission) return <p className="p-8 text-muted">Loading invite…</p>;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title={String(mission.title)}
        subtitle={`${String(mission.projectName)} · ${String(mission.releaseLabel)}`}
      />
      <Notice title="Mission instructions" tone="action">
        {String(mission.instructions)}
      </Notice>
      <div className="mt-4">
        <a href={String(mission.sourceUrl || mission.liveUrl)} target="_blank" rel="noreferrer">
          <Button variant="secondary">Open target app in new tab</Button>
        </a>
      </div>
      {!me ? (
        <div className="mt-6">
          <Notice title="Sign in to submit" tone="neutral">
            <Link to="/signin">Sign in</Link> first. Self-review by the project owner is blocked.
          </Notice>
        </div>
      ) : done ? (
        <div className="mt-6">
          <Notice title="Review submitted" tone="positive">
            Thank you. Useful critical feedback earns recognition — praise is not required.
          </Notice>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <p className="font-semibold">
            What happened, what did you expect, and where did you get stuck?
          </p>
          <div>
            <Label>What you tried</Label>
            <TextArea
              required
              value={form.tried}
              onChange={(e) => setForm((f) => ({ ...f, tried: e.target.value }))}
            />
          </div>
          <div>
            <Label>What you expected</Label>
            <TextArea
              required
              value={form.expected}
              onChange={(e) => setForm((f) => ({ ...f, expected: e.target.value }))}
            />
          </div>
          <div>
            <Label>Where you got stuck</Label>
            <TextArea
              value={form.stuck}
              onChange={(e) => setForm((f) => ({ ...f, stuck: e.target.value }))}
            />
          </div>
          <div>
            <Label>Observations</Label>
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
              <Label>Audience fit</Label>
              <select
                className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
                value={form.audienceFit}
                onChange={(e) => setForm((f) => ({ ...f, audienceFit: e.target.value }))}
              >
                <option value="target_user">Target user</option>
                <option value="peer">Peer reviewer</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <Label>Outcome</Label>
              <select
                className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
              >
                <option value="completed">Completed</option>
                <option value="with_help">Completed with help</option>
                <option value="could_not_complete">Could not complete</option>
                <option value="not_attempted">Not attempted</option>
              </select>
            </div>
          </div>
          {error ? (
            <Notice title="Could not submit" tone="danger">
              {error}
            </Notice>
          ) : null}
          <Button type="submit">Submit review</Button>
        </form>
      )}
    </div>
  );
}
