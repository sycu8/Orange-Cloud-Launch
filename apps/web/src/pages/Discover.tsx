import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, EmptyState, PageHeader, StatusPill } from "../components/ui";

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
  const { me } = useAuth();
  const { t } = useI18n();
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
        title={t("discover.title")}
        subtitle={t("discover.subtitle")}
        actions={
          <Link to={me ? "/app/inbox" : "/signin?next=/app/inbox"} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              {me ? t("discover.openInbox") : t("discover.signInReview")}
            </Button>
          </Link>
        }
      />
      {error ? <p className="text-[#9B1C1C]">{error}</p> : null}
      {!error && projects.length === 0 ? (
        <EmptyState
          title={t("discover.emptyTitle")}
          body={t("discover.emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to={me ? "/app/inbox" : "/signin?next=/app/inbox"}>
                <Button>{me ? t("discover.openInbox") : t("discover.signInReview")}</Button>
              </Link>
              <Link to={me ? "/app/new" : "/signin?next=/app/new"}>
                <Button variant="secondary">{t("home.cta.add")}</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {projects.map((p) => (
            <li
              key={p.slug}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link to={`/p/${p.slug}`} className="text-lg font-semibold text-ink no-underline">
                  {p.name}
                </Link>
                <p className="text-sm text-muted">{p.purpose}</p>
                <p className="mt-1 text-xs text-muted">
                  {p.category} · audience: {p.audience}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={p.open_missions > 0 ? "action" : "neutral"}>
                  {p.open_missions > 0
                    ? `${p.open_missions} ${
                        p.open_missions === 1
                          ? t("discover.openMissions")
                          : t("discover.openMissionsPlural")
                      }`
                    : t("discover.noMissions")}
                </StatusPill>
                {p.open_missions > 0 ? (
                  <Link to={me ? "/app/inbox" : "/signin?next=/app/inbox"}>
                    <Button variant="secondary">{t("discover.review")}</Button>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
