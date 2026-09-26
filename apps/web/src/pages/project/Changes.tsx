import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, EmptyState, Input, Label, Notice } from "../../components/ui";

type ChangeSet = {
  id: string;
  base_sha: string;
  state: string;
  export_artifact_id: string | null;
  preview_url: string | null;
  pr_url: string | null;
};

type Finding = { id: string; title: string; state: string; release_id: string };

export function ChangesPage() {
  const { id } = useParams();
  const [changeSets, setChangeSets] = useState<ChangeSet[]>([]);
  const [accepted, setAccepted] = useState<Finding[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [baseSha, setBaseSha] = useState("main-unknown");
  const [packageJson, setPackageJson] = useState('{\n  "dependencies": {\n    "react": "^19.0.0"\n  },\n  "devDependencies": {\n    "vite": "^7.0.0",\n    "tailwindcss": "^4.0.0"\n  }\n}');
  const [stackNote, setStackNote] = useState<string | null>(null);
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
      findings.push(...detail.findings.filter((f) => f.state === "accepted"));
    }
    setAccepted(findings);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function detectStack() {
    setError(null);
    try {
      const res = await api<{
        supported: boolean;
        profile: string;
        message: string;
        recommendation: string;
        draftPrStatus: string;
      }>(`/api/projects/${id}/stack-detect`, {
        method: "POST",
        body: JSON.stringify({ packageJson }),
      });
      setStackNote(
        `${res.profile}: ${res.message} Recommendation: ${res.recommendation.replaceAll("_", " ")}. Draft PR status: ${res.draftPrStatus}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function createChangeSet() {
    try {
      const res = await api<{ id: string }>(`/api/projects/${id}/changes`, {
        method: "POST",
        body: JSON.stringify({ findingIds: selected, baseSha }),
      });
      setMessage(`Change set ${res.id} proposed`);
      setSelected([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function exportBundle(changeId: string) {
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/changes/${changeId}/export`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { artifactId?: string })
        : null;
      setMessage(
        parsed?.artifactId
          ? "Agent export ready — download the task bundle."
          : "Export job finished",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function requestBuild(changeId: string) {
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/changes/${changeId}/build`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { status?: string; message?: string })
        : null;
      if (parsed?.status === "integration_not_configured") {
        setError(parsed.message ?? "Integration not configured");
      } else {
        setMessage("Build requested");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold">Improvement studio</h2>
        <p className="mt-1 text-sm text-muted">
          Path 1: export a coherent task bundle for your coding agent. Path 2: sandbox preview +
          draft PR for supported React/Vite + Tailwind repos (requires credentials).
        </p>
        <div className="mt-4 space-y-2">
          <Label>Base commit SHA</Label>
          <Input value={baseSha} onChange={(e) => setBaseSha(e.target.value)} />
        </div>
        <div className="mt-4 space-y-2">
          <Label>Detect repo profile (paste package.json)</Label>
          <textarea
            className="min-h-[120px] w-full rounded-[10px] border border-input-border bg-surface px-3 py-2 font-mono text-xs"
            value={packageJson}
            onChange={(e) => setPackageJson(e.target.value)}
          />
          <Button variant="secondary" type="button" onClick={() => void detectStack()}>
            Detect stack
          </Button>
          {stackNote ? (
            <Notice title="Stack detection" tone="action">
              {stackNote}
            </Notice>
          ) : null}
        </div>
        <h3 className="mt-4 font-semibold">Accepted findings</h3>
        {accepted.length === 0 ? (
          <EmptyState
            title="No accepted findings"
            body="Triage and accept findings on a release before proposing a change set."
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
        <Button className="mt-4" disabled={!selected.length} onClick={() => void createChangeSet()}>
          Propose change set
        </Button>
      </div>
      <div>
        <h3 className="font-semibold">Change sets</h3>
        {changeSets.length === 0 ? (
          <EmptyState title="None yet" body="Proposed improvements will appear here." />
        ) : (
          <ul className="mt-3 space-y-3">
            {changeSets.map((cs) => (
              <li key={cs.id} className="rounded-[16px] border border-border bg-surface p-4">
                <p className="font-semibold">{cs.id}</p>
                <p className="text-sm text-muted">
                  {cs.state} · base {cs.base_sha}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void exportBundle(cs.id)}>
                    Export for coding agent
                  </Button>
                  {cs.export_artifact_id ? (
                    <a href={`/api/projects/${id}/changes/${cs.id}/export-download`}>
                      <Button variant="ghost">Download bundle</Button>
                    </a>
                  ) : null}
                  <Button onClick={() => void requestBuild(cs.id)}>Preview / draft PR</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {message ? (
          <div className="mt-4">
            <Notice title="Update" tone="positive">
              {message}
            </Notice>
          </div>
        ) : null}
        {error ? (
          <div className="mt-4">
            <Notice title="Integration or validation" tone="danger">
              {error}
            </Notice>
          </div>
        ) : null}
      </div>
    </div>
  );
}
