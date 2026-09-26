import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
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
  const [missions, setMissions] = useState<InboxMission[]>([]);
  const [active, setActive] = useState<InboxMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
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

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me) return <Navigate to="/signin" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setError(null);
    try {
      await api(`/api/missions/${active.missionId}/reviews`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setDone(active.missionId);
      setActive(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Review inbox"
        subtitle="Open public and unlisted missions, excluding your own projects and prior reviews."
      />
      {done ? (
        <div className="mb-4">
          <Notice title="Review submitted" tone="positive">
            Credit recorded for useful feedback — praise is not required.
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4">
          <Notice title="Error" tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
      {missions.length === 0 && !active ? (
        <EmptyState
          title="No matching missions right now"
          body="When founders open public review requests, they appear here with fair waiting-time ordering."
          action={
            <Link to="/discover">
              <Button variant="secondary">Browse Discover</Button>
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
                    {m.releaseLabel} · audience {m.audience}
                    {m.topicTags?.length ? ` · ${m.topicTags.join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <a href={m.sourceUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="w-full sm:w-auto">
                      Open app
                    </Button>
                  </a>
                  <Button className="w-full sm:w-auto" onClick={() => setActive(m)}>
                    Submit review
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
          <h3 className="font-semibold">Review: {active.title}</h3>
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
            <Input
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
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Submit review</Button>
            <Button type="button" variant="ghost" onClick={() => setActive(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
