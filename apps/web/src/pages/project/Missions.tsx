import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
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
  const { data } = useOutletContext<{ data: ProjectDetail }>();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [title, setTitle] = useState("First-use weekly plan");
  const [instructions, setInstructions] = useState(
    data.project.primary_task || "Create your first weekly plan without help.",
  );
  const [invite, setInvite] = useState<string | null>(null);
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

  async function createMission(e: React.FormEvent) {
    e.preventDefault();
    if (!releaseId) {
      setError("Capture a release before creating a mission.");
      return;
    }
    try {
      const res = await api<{ invitePath: string; inviteToken: string }>(
        `/api/projects/${id}/releases/${releaseId}/missions`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            instructions,
            topicTags: ["productivity", "first-use"],
            language: "en",
            state: "open",
          }),
        },
      );
      setInvite(`${window.location.origin}/review/${res.inviteToken}`);
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
      setInvite(`${window.location.origin}/review/${res.inviteToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold">Review Missions</h2>
        <p className="mt-1 text-sm text-muted">
          Each new release starts with five dangerous-path missions (private window, logged-out
          protected page, another account’s data, phone width, empty/failed save).{" "}
          <em>Could not complete</em> is a successful critical review. Self-review is blocked —
          solo founders can log a note on the release instead.
        </p>
        {latest ? (
          <div className="mt-3">
            <Link to={`/app/projects/${id}/releases/${latest.id}`}>
              <Button variant="secondary">Log a founder note on {latest.label}</Button>
            </Link>
          </div>
        ) : null}
        {missions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No missions yet"
              body="Define a specific task reviewers can attempt against a frozen release."
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {missions.map((m) => (
              <li key={m.id} className="rounded-[16px] border border-border bg-surface p-4">
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-muted">{m.instructions}</p>
                <p className="mt-2 text-xs text-muted">
                  {m.state}
                  {data.releases.find((r) => r.id === m.release_id)
                    ? ` · ${data.releases.find((r) => r.id === m.release_id)!.label}`
                    : ""}
                </p>
                {m.state === "open" ? (
                  <Button
                    className="mt-3"
                    variant="secondary"
                    onClick={() => void rotateInvite(m.id)}
                  >
                    Copy new invite link
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={(e) => void createMission(e)} className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
        <h3 className="font-semibold">What are you trying to help someone do?</h3>
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label>Instructions</Label>
          <TextArea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={!releaseId}>
          Create focused mission
        </Button>
        {invite ? (
          <Notice title="Share this invite link" tone="action">
            <code className="break-all text-xs">{invite}</code>
            <p className="mt-2">Rotating a link invalidates the previous one.</p>
          </Notice>
        ) : null}
        {error ? (
          <Notice title="Could not create mission" tone="danger">
            {error}
          </Notice>
        ) : null}
      </form>
    </div>
  );
}
