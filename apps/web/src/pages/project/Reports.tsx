import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n, useLabel } from "../../lib/i18n";
import { Button, EmptyState, Notice } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

type Report = {
  id: string;
  release_id: string;
  release_label?: string;
  version: number;
  created_at: string;
  environment?: string | null;
  human_sample_size?: number | null;
};

type CompareResult = {
  newFindingTitles: string[];
  improvedTitles: string[];
  note: string;
};

export function ReportsPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const label = useLabel();
  const { data } = useOutletContext<{ data: ProjectDetail }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api<{ reports: Report[] }>(`/api/projects/${id}/reports`);
    setReports(res.reports);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function share(reportId: string) {
    try {
      const res = await api<{ path: string }>(
        `/api/projects/${id}/reports/${reportId}/shares`,
        { method: "POST", body: "{}" },
      );
      setSharePath(res.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function runCompare() {
    const [target, base] = data.releases;
    if (!target || !base) {
      setError(t("reports.compareNeedTwo"));
      return;
    }
    try {
      const res = await api<CompareResult>(
        `/api/projects/${id}/releases/${target.id}/compare/${base.id}`,
      );
      setCompare(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  const canCompare = data.releases.length >= 2;

  return (
    <div>
      <h2 className="text-xl font-semibold">{t("reports.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("reports.subtitle")}</p>
      <div className="mt-4">
        <Button variant="secondary" disabled={!canCompare} onClick={() => void runCompare()}>
          {t("reports.compare")}
        </Button>
        {!canCompare ? (
          <p className="mt-2 text-sm text-muted">{t("reports.compareNeedTwo")}</p>
        ) : null}
      </div>
      {compare ? (
        <div className="mt-4">
          <Notice title={t("reports.comparison")} tone="action">
            <p>{t("reports.compareNote")}</p>
            <p className="mt-2">
              {t("reports.new")}:{" "}
              {compare.newFindingTitles.length
                ? compare.newFindingTitles.join("; ")
                : t("reports.none")}
            </p>
            <p>
              {t("reports.improved")}:{" "}
              {compare.improvedTitles.length
                ? compare.improvedTitles.join("; ")
                : t("reports.none")}
            </p>
          </Notice>
        </div>
      ) : null}
      {reports.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t("reports.emptyTitle")} body={t("reports.emptyBody")} />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-[16px] border border-border bg-surface p-4">
              <p className="font-semibold">
                {r.release_label ?? t("reports.release")}
              </p>
              <p className="text-sm text-muted">
                {r.environment ? `${label("env", r.environment)} · ` : ""}
                {new Date(r.created_at).toLocaleString()}
                {r.human_sample_size != null
                  ? ` · ${r.human_sample_size} ${
                      r.human_sample_size === 1
                        ? t("reports.humanReview")
                        : t("reports.humanReviews")
                    }`
                  : ""}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link to={`/app/projects/${id}/reports/${r.id}`} className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">{t("reports.open")}</Button>
                </Link>
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void share(r.id)}>
                  {t("reports.share")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {sharePath ? (
        <div className="mt-4">
          <Notice title={t("reports.shareCreated")} tone="action">
            <a className="break-all" href={sharePath}>
              {sharePath}
            </a>
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice title={t("common.error")} tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
