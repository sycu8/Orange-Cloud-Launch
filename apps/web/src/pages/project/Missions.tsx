import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
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

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold">Review Missions</h2>
        <p className="mt-1 text-sm text-muted">
          Scoped invite links do not expose repositories or private settings. Invitations are not
          sent automatically.
        </p>
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
                  {m.state} · release {m.release_id}
                </p>
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
