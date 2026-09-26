import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n, useLabel } from "../../lib/i18n";
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
  const label = useLabel();
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
    `inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-semibold no-underline ${
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
          <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{data.project.name}</h1>
          <p className="mt-1 text-muted">{data.project.purpose}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral">{label("role", data.role)}</StatusPill>
          <StatusPill tone={data.project.visibility === "public" ? "positive" : "neutral"}>
            {label("visibility", data.project.visibility)}
          </StatusPill>
          {publicPassport ? (
            <Link
              to={`/p/${data.project.slug}`}
              className="inline-flex min-h-[44px] items-center text-sm font-semibold"
            >
              {t("passport.open")}
            </Link>
          ) : (
            <span className="max-w-[16rem] text-xs text-muted">{t("passport.private")}</span>
          )}
        </div>
      </div>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 pb-3 sm:mx-0 sm:flex-wrap sm:px-0">
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
