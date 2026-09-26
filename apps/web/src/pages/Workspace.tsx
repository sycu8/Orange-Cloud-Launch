import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, EmptyState, Notice, PageHeader, StatusPill } from "../components/ui";

type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  purpose: string;
  visibility: string;
  updated_at: string;
  release_count: number;
  open_missions: number;
  open_findings: number;
  latest_release_id: string | null;
  latest_release_label: string | null;
};

export function WorkspacePage() {
  const { me, loading } = useAuth();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [credits, setCredits] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{
      projects: WorkspaceProject[];
      credits: number;
      reviewInboxCount: number;
    }>("/api/workspace")
      .then((d) => {
        setProjects(d.projects);
        setCredits(d.credits);
        setInboxCount(d.reviewInboxCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [me]);

  if (loading) return <p className="text-muted">Loading session…</p>;
  if (!me) return <Navigate to="/signin" replace />;

  return (
    <div>
      <PageHeader
        title="My projects"
        subtitle="Continue the next useful action in your improvement loop."
        actions={
          <Link to="/app/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Add your project</Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          to="/app/inbox"
          className="rounded-[16px] border border-border bg-surface px-4 py-4 text-ink no-underline transition-transform duration-160 hover:-translate-y-0.5"
        >
          <p className="text-sm font-semibold text-muted">Review inbox</p>
          <p className="mt-1 text-2xl font-bold">
            {inboxCount} open
            <span className="ml-2 text-sm font-semibold text-muted">mission{inboxCount === 1 ? "" : "s"}</span>
          </p>
        </Link>
        <div className="rounded-[16px] border border-border bg-surface px-4 py-4">
          <p className="text-sm font-semibold text-muted">Review credits</p>
          <p className="mt-1 text-2xl font-bold">
            {credits}
            <span className="ml-2 text-sm font-semibold text-muted">earned for useful feedback</span>
          </p>
        </div>
      </div>

      {error ? (
        <Notice title="Could not load workspace" tone="danger">
          {error}
        </Notice>
      ) : null}
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Create a project to capture releases, request focused reviews, and track verified improvements."
          action={
            <Link to="/app/new">
              <Button>Add your project</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const next =
              !p.latest_release_id
                ? "Capture a release"
                : p.open_findings > 0
                  ? `Triage ${p.open_findings} open finding${p.open_findings === 1 ? "" : "s"}`
                  : p.open_missions > 0
                    ? "Awaiting mission reviews"
                    : "Request a review or export improvements";
            return (
              <li key={p.id}>
                <Link
                  to={`/app/projects/${p.id}/overview`}
                  className="block rounded-[16px] border border-border bg-surface px-4 py-4 text-ink no-underline transition-transform duration-160 hover:-translate-y-0.5 sm:px-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{p.name}</h2>
                      <p className="mt-1 text-sm text-muted">{p.purpose}</p>
                    </div>
                    <StatusPill tone={p.visibility === "public" ? "positive" : "neutral"}>
                      {p.visibility}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
                    <span>{p.release_count} release{p.release_count === 1 ? "" : "s"}</span>
                    <span>
                      {p.latest_release_label
                        ? `Latest: ${p.latest_release_label}`
                        : "No release yet"}
                    </span>
                    <span className="text-action">Next: {next}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
