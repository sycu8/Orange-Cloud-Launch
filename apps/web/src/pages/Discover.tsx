import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusPill } from "../components/ui";

type DiscoverProject = {
  slug: string;
  name: string;
  description: string;
  purpose: string;
  audience: string;
  category: string;
  live_url: string | null;
  open_missions: number;
};

export function DiscoverPage() {
  const [projects, setProjects] = useState<DiscoverProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ projects: DiscoverProject[] }>("/api/discover")
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Discover review requests"
        subtitle="Opt-in public projects only. Visibility defaults to private."
      />
      {error ? <p className="text-[#9B1C1C]">{error}</p> : null}
      {!error && projects.length === 0 ? (
        <EmptyState
          title="No public projects yet"
          body="When founders opt into the directory, focused review missions appear here."
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {projects.map((p) => (
            <li key={p.slug} className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link to={`/p/${p.slug}`} className="text-lg font-semibold text-ink no-underline">
                  {p.name}
                </Link>
                <p className="text-sm text-muted">{p.purpose}</p>
                <p className="mt-1 text-xs text-muted">
                  {p.category} · audience: {p.audience}
                </p>
              </div>
              <StatusPill tone={p.open_missions > 0 ? "action" : "neutral"}>
                {p.open_missions > 0
                  ? `${p.open_missions} open mission${p.open_missions === 1 ? "" : "s"}`
                  : "No open missions"}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
