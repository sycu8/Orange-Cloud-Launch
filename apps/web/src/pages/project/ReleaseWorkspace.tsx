import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, EmptyState, Input, Label, Notice, StatusPill, TextArea } from "../../components/ui";
import { getCsrfToken } from "../../lib/api";

type Finding = {
  id: string;
  title: string;
  body: string;
  provenance: string;
  category: string;
  severity: string;
  state: string;
  record_version: number;
  acceptance_criterion: string | null;
};

function parseReviewBody(body: string) {
  const tried = body.match(/Tried:\s*([\s\S]*?)(?:\n\nExpected:|$)/)?.[1]?.trim();
  const expected = body.match(/Expected:\s*([\s\S]*?)(?:\n\nStuck:|\n\nObservations:|$)/)?.[1]?.trim();
  const stuck = body.match(/Stuck:\s*([\s\S]*?)(?:\n\nObservations:|$)/)?.[1]?.trim();
  const observations = body.match(/Observations:\s*([\s\S]*)$/)?.[1]?.trim();
  if (tried || expected || observations) {
    return { tried, expected, stuck, observations };
  }
  return null;
}

export function ReleaseWorkspacePage() {
  const { id, releaseId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [release, setRelease] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingBody, setFindingBody] = useState("");
  const [findingCategory, setFindingCategory] = useState("First-use experience");
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState("");

  async function load() {
    const data = await api<{ release: Record<string, unknown>; findings: Finding[] }>(
      `/api/projects/${id}/releases/${releaseId}`,
    );
    setRelease(data.release);
    setFindings(data.findings);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id, releaseId]);

  async function triage(f: Finding, state: string, dismissRationale?: string) {
    setError(null);
    try {
      await api(`/api/projects/${id}/findings/${f.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          state,
          expectedVersion: f.record_version,
          dismissRationale: state === "dismissed" ? dismissRationale : undefined,
        }),
      });
      setNote(`Finding marked ${state.replaceAll("_", " ")}`);
      setDismissingId(null);
      setDismissReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function verify(f: Finding) {
    try {
      await api(`/api/projects/${id}/releases/${releaseId}/verify`, {
        method: "POST",
        body: JSON.stringify({
          findingId: f.id,
          criterion: f.acceptance_criterion || f.title,
          result: "pass",
          checkedSha: release?.commit_sha ?? undefined,
          notes: "Owner verified against the captured release revision.",
        }),
      });
      setNote(t("release.verifiedNote"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function runAutomated() {
    setError(null);
    setNote(null);
    try {
      const result = await api<{
        job: { state: string; result_json?: string };
      }>(`/api/projects/${id}/releases/${releaseId}/runs`, {
        method: "POST",
        body: "{}",
      });
      const parsed = result.job.result_json
        ? (JSON.parse(result.job.result_json) as {
            browser?: { status?: string; captureCount?: number; message?: string };
          })
        : null;
      if (parsed?.browser?.status === "completed" && (parsed.browser.captureCount ?? 0) > 0) {
        setNote(
          `Automated checks finished. Browser Run captured ${parsed.browser.captureCount} human-tester snapshot(s). Deterministic and browser notes are not human outcomes.`,
        );
      } else if (parsed?.browser?.status === "integration_not_configured") {
        setNote(
          "Automated checks finished. Deterministic findings may appear below; Browser Run stays not-configured until credentials are set.",
        );
      } else {
        setNote(
          parsed?.browser?.message ??
            "Automated checks finished. Review findings below — human task results still come from reviewers.",
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function logFinding(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/projects/${id}/releases/${releaseId}/findings`, {
        method: "POST",
        body: JSON.stringify({
          title: findingTitle,
          body: findingBody,
          category: findingCategory,
          severity: "medium",
        }),
      });
      setFindingTitle("");
      setFindingBody("");
      setNote("Founder note logged. Accept it, then propose an improvement.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function uploadEvidence(file: File) {
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("releaseId", releaseId ?? "");
    try {
      const headers: HeadersInit = {};
      const csrf = getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const res = await fetch(`/api/projects/${id}/artifacts`, {
        method: "POST",
        body,
        credentials: "include",
        headers,
      });
      const data = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setUploadNote(`Evidence stored as ${data.id} (private R2).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function generateReport() {
    try {
      const res = await api<{ job: { result_json?: string } }>(
        `/api/projects/${id}/releases/${releaseId}/reports`,
        { method: "POST", body: "{}" },
      );
      const parsed = res.job.result_json
        ? (JSON.parse(res.job.result_json) as { reportId?: string })
        : null;
      if (parsed?.reportId) {
        navigate(`/app/projects/${id}/reports/${parsed.reportId}`);
      } else {
        setNote("Report job finished");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!release) return <p className="text-muted">{t("common.loading")}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{String(release.label)}</h2>
          <p className="text-sm text-muted">{String(release.source_url)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={String(release.source_url)} target="_blank" rel="noreferrer">
            <Button variant="secondary">{t("release.openApp")}</Button>
          </a>
          <Button variant="secondary" onClick={() => void runAutomated()}>
            {t("release.runAutomated")}
          </Button>
          <Button onClick={() => void generateReport()}>{t("release.generateReport")}</Button>
          <Link to={`/app/projects/${id}/missions`}>
            <Button variant="ghost">{t("release.invite")}</Button>
          </Link>
        </div>
      </div>
      {note ? (
        <Notice title={t("common.update")} tone="positive">
          {note}
        </Notice>
      ) : null}
      {uploadNote ? (
        <div className="mt-3">
          <Notice title={t("release.evidenceUploaded")} tone="positive">
            {uploadNote}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Notice title={t("common.error")} tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => void logFinding(e)}
          className="space-y-3 rounded-[16px] border border-border bg-surface p-4"
        >
          <h3 className="font-semibold">{t("release.founderNote")}</h3>
          <p className="text-sm text-muted">{t("release.founderNoteBody")}</p>
          <div>
            <Label>{t("release.whatBetter")}</Label>
            <Input
              required
              value={findingTitle}
              onChange={(e) => setFindingTitle(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("release.whatObserved")}</Label>
            <TextArea
              required
              value={findingBody}
              onChange={(e) => setFindingBody(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("release.category")}</Label>
            <select
              className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
              value={findingCategory}
              onChange={(e) => setFindingCategory(e.target.value)}
            >
              <option>First-use experience</option>
              <option>Access</option>
              <option>Regression</option>
              <option>Clarity</option>
              <option>Visual consistency</option>
              <option>Accessibility</option>
              <option>Release presentation</option>
            </select>
          </div>
          <Button type="submit">{t("release.addFinding")}</Button>
        </form>
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <Label>{t("release.uploadEvidence")}</Label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,text/plain,application/json"
            className="mt-2 block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadEvidence(file);
            }}
          />
        </div>
      </div>

      <h3 className="mt-6 text-lg font-semibold">{t("findings.title")}</h3>
      {findings.length === 0 ? (
        <EmptyState title={t("findings.emptyTitle")} body={t("findings.emptyBody")} />
      ) : (
        <ul className="mt-3 space-y-3">
          {findings.map((f) => {
            const review = f.provenance === "human_observation" ? parseReviewBody(f.body) : null;
            return (
              <li key={f.id} className="rounded-[16px] border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{f.title}</h4>
                  <StatusPill tone="neutral">{f.provenance.replaceAll("_", " ")}</StatusPill>
                  <StatusPill tone={f.state === "verified" ? "positive" : "action"}>
                    {f.state.replaceAll("_", " ")}
                  </StatusPill>
                  <StatusPill tone="neutral">{f.severity}</StatusPill>
                </div>
                {review ? (
                  <div className="mt-3 space-y-2 text-sm">
                    {review.tried ? (
                      <p>
                        <span className="font-semibold">{t("findings.tried")}: </span>
                        {review.tried}
                      </p>
                    ) : null}
                    {review.expected ? (
                      <p>
                        <span className="font-semibold">{t("findings.expected")}: </span>
                        {review.expected}
                      </p>
                    ) : null}
                    {review.stuck ? (
                      <p>
                        <span className="font-semibold">{t("findings.stuck")}: </span>
                        {review.stuck}
                      </p>
                    ) : null}
                    {review.observations ? (
                      <p>
                        <span className="font-semibold">{t("findings.observations")}: </span>
                        {review.observations}
                      </p>
                    ) : null}
                  </div>
                ) : f.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{f.body}</p>
                ) : null}
                <p className="mt-2 text-sm text-muted">
                  {f.category}
                  {f.acceptance_criterion
                    ? ` · ${t("findings.criterion")}: ${f.acceptance_criterion}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.state === "observed" || f.state === "triaged" || f.state === "reopened" ? (
                    <>
                      <Button onClick={() => void triage(f, "accepted")}>
                        {t("findings.accept")}
                      </Button>
                      <Button variant="ghost" onClick={() => void triage(f, "needs_evidence")}>
                        {t("findings.needEvidence")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDismissingId(f.id);
                          setDismissReason("");
                        }}
                      >
                        {t("findings.dismiss")}
                      </Button>
                    </>
                  ) : null}
                  {f.state === "accepted" ? (
                    <Link to={`/app/projects/${id}/changes`}>
                      <Button>{t("findings.propose")}</Button>
                    </Link>
                  ) : null}
                  {(f.state === "accepted" || f.state === "change_proposed") && (
                    <Button variant="secondary" onClick={() => void triage(f, "implemented")}>
                      {t("findings.markImplemented")}
                    </Button>
                  )}
                  {(f.state === "implemented" || f.state === "verification_pending") && (
                    <Button variant="secondary" onClick={() => void verify(f)}>
                      {t("findings.markVerified")}
                    </Button>
                  )}
                  {f.state === "verified" ? (
                    <StatusPill tone="positive">{t("findings.loopDone")}</StatusPill>
                  ) : null}
                </div>
                {dismissingId === f.id ? (
                  <div className="mt-3 space-y-2 rounded-[12px] border border-border bg-canvas p-3">
                    <Label>{t("findings.dismissWhy")}</Label>
                    <TextArea
                      required
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={dismissReason.trim().length < 3}
                        onClick={() => void triage(f, "dismissed", dismissReason.trim())}
                      >
                        {t("findings.dismiss")}
                      </Button>
                      <Button variant="ghost" onClick={() => setDismissingId(null)}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
