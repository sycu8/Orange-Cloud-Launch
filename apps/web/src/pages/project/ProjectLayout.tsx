import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { StatusPill } from "../../components/ui";

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    slug: string;
    purpose: string;
    audience: string;
    live_url: string | null;
    visibility: string;
    primary_task: string;
  };
  role: string;
  releases: Array<{
    id: string;
    label: string;
    source_url: string;
    commit_sha: string | null;
    captured_at: string;
    environment?: string;
    reviewed_url?: string | null;
  }>;
  loop?: {
    open_missions: number;
    open_findings: number;
    accepted_findings: number;
    in_progress_findings: number;
    verified_findings: number;
    change_sets: number;
    implemented_changes: number;
    reports: number;
  };
};

export function ProjectLayout() {
  const { me, loading } = useAuth();
  const { t } = useI18n();
  const { id } = useParams();
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me || !id) return;
    api<ProjectDetail>(`/api/projects/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [me, id]);

  if (loading) return <p className="text-muted">{t("common.loading")}</p>;
  if (!me) return <Navigate to={`/signin?next=/app/projects/${id}/overview`} replace />;
  if (error) return <p className="text-[#9B1C1C]">{error}</p>;
  if (!data) return <p className="text-muted">{t("common.loading")}</p>;

  const base = `/app/projects/${id}`;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-[10px] px-3 py-2 text-sm font-semibold no-underline ${
      isActive ? "bg-orange-tint text-action" : "text-muted hover:text-ink"
    }`;
  const publicPassport =
    data.project.visibility === "public" || data.project.visibility === "unlisted";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link to="/app" className="text-muted">
              {t("nav.myProjects")}
            </Link>{" "}
            / {data.project.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{data.project.name}</h1>
          <p className="mt-1 text-muted">{data.project.purpose}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral">{data.role}</StatusPill>
          <StatusPill tone={data.project.visibility === "public" ? "positive" : "neutral"}>
            {data.project.visibility}
          </StatusPill>
          {publicPassport ? (
            <Link to={`/p/${data.project.slug}`} className="text-sm font-semibold">
              Passport
            </Link>
          ) : (
            <span className="max-w-[14rem] text-xs text-muted">{t("passport.private")}</span>
          )}
        </div>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border pb-3">
        <NavLink to={`${base}/overview`} className={linkClass}>
          {t("nav.overview")}
        </NavLink>
        <NavLink to={`${base}/missions`} className={linkClass}>
          {t("nav.reviews")}
        </NavLink>
        <NavLink to={`${base}/changes`} className={linkClass}>
          {t("nav.improvements")}
        </NavLink>
        <NavLink to={`${base}/reports`} className={linkClass}>
          {t("nav.reports")}
        </NavLink>
        <NavLink to={`${base}/settings`} className={linkClass}>
          {t("nav.settings")}
        </NavLink>
      </nav>
      <Outlet
        context={{
          data,
          reload: () => api<ProjectDetail>(`/api/projects/${id}`).then(setData),
        }}
      />
    </div>
  );
}
