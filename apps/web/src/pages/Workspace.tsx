import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
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
  const { t } = useI18n();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{
      projects: WorkspaceProject[];
      reviewInboxCount: number;
    }>("/api/workspace")
      .then((d) => {
        setProjects(d.projects);
        setInboxCount(d.reviewInboxCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [me]);

  if (loading) return <p className="text-muted">{t("common.loading")}</p>;
  if (!me) return <Navigate to="/signin?next=/app" replace />;

  return (
    <div>
      <PageHeader
        title={t("workspace.title")}
        subtitle={t("workspace.subtitle")}
        actions={
          <Link to="/app/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">{t("workspace.add")}</Button>
          </Link>
        }
      />

      <div className="mb-6">
        <Link
          to="/app/inbox"
          className="block rounded-[16px] border border-border bg-surface px-4 py-4 text-ink no-underline transition-transform duration-160 hover:-translate-y-0.5 sm:max-w-md"
        >
          <p className="text-sm font-semibold text-muted">{t("workspace.inbox")}</p>
          <p className="mt-1 text-2xl font-bold">
            {inboxCount} {t("workspace.openMissions")}
            <span className="ml-2 text-sm font-semibold text-muted">
              {inboxCount === 1 ? t("workspace.mission") : t("workspace.missions")}
            </span>
          </p>
        </Link>
      </div>

      {error ? (
        <Notice title={t("common.error")} tone="danger">
          {error}
        </Notice>
      ) : null}
      {projects.length === 0 ? (
        <EmptyState
          title={t("workspace.emptyTitle")}
          body={t("workspace.emptyBody")}
          action={
            <Link to="/app/new">
              <Button>{t("workspace.add")}</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const next =
              !p.latest_release_id
                ? t("workspace.next.capture")
                : p.open_findings > 0
                  ? t("workspace.next.triage")
                  : p.open_missions > 0
                    ? t("workspace.next.awaiting")
                    : t("workspace.next.export");
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
                    <span>
                      {p.release_count}{" "}
                      {p.release_count === 1 ? t("workspace.release") : t("workspace.releases")}
                    </span>
                    <span>
                      {p.latest_release_label
                        ? `${t("workspace.latest")}: ${p.latest_release_label}`
                        : t("workspace.noRelease")}
                    </span>
                    <span className="text-action">
                      {t("workspace.next")}: {next}
                    </span>
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
