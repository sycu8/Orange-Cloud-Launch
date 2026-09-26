import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, EmptyState, PageHeader, StatusPill } from "../components/ui";

type Project = {
  id: string;
  name: string;
  slug: string;
  purpose: string;
  visibility: string;
  updated_at: string;
};

export function WorkspacePage() {
  const { me, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{ projects: Project[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
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
          <Link to="/app/new">
            <Button>Add your project</Button>
          </Link>
        }
      />
      {error ? <p className="text-[#9B1C1C]">{error}</p> : null}
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
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/app/projects/${p.id}/overview`}
                className="block rounded-[16px] border border-border bg-surface px-5 py-4 text-ink no-underline transition-transform duration-160 hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <StatusPill tone={p.visibility === "public" ? "positive" : "neutral"}>
                    {p.visibility}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm text-muted">{p.purpose}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
