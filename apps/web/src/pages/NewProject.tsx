import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Input, Label, Notice, PageHeader, TextArea } from "../components/ui";

export function NewProjectPage() {
  const { me, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    purpose: "",
    audience: "",
    primaryTask: "",
    liveUrl: "",
    category: "productivity",
    visibility: "private",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="text-muted">{t("common.loading")}</p>;
  if (!me) return <Navigate to="/signin?next=/app/new" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(form),
      });
      nav(`/app/projects/${created.id}/overview`);
    } catch (err) {
      const apiErr = err as Error & { api?: { nextAction?: string; message?: string } };
      setError(
        [apiErr.api?.message || apiErr.message, apiErr.api?.nextAction]
          .filter(Boolean)
          .join(" — "),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title={t("project.new.title")} subtitle={t("project.new.subtitle")} />
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <Label>{t("project.new.name")}</Label>
          <Input
            required
            value={form.name}
            placeholder={t("project.new.namePh")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 48),
              }))
            }
          />
          {form.slug ? (
            <p className="mt-1 text-sm text-muted">
              {t("project.new.slugHint")}: {form.slug}
            </p>
          ) : null}
        </div>
        <div>
          <Label>{t("project.new.purpose")}</Label>
          <TextArea
            required
            value={form.purpose}
            placeholder={t("project.new.purposePh")}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <div>
          <Label>{t("project.new.audience")}</Label>
          <Input
            required
            value={form.audience}
            placeholder={t("project.new.audiencePh")}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
          />
        </div>
        <div>
          <Label>{t("project.new.primaryTask")}</Label>
          <Input
            value={form.primaryTask}
            onChange={(e) => setForm((f) => ({ ...f, primaryTask: e.target.value }))}
            placeholder={t("project.new.primaryTaskPh")}
          />
        </div>
        <div>
          <Label>{t("project.new.liveUrl")}</Label>
          <Input
            type="url"
            value={form.liveUrl}
            onChange={(e) => setForm((f) => ({ ...f, liveUrl: e.target.value }))}
            placeholder="https://"
          />
          <p className="mt-1 text-sm text-muted">{t("project.new.liveUrlHelp")}</p>
        </div>
        <div>
          <Label>{t("project.new.visibility")}</Label>
          <select
            className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3 text-base"
            value={form.visibility}
            onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
          >
            <option value="private">{t("project.new.private")}</option>
            <option value="unlisted">{t("project.new.unlisted")}</option>
            <option value="public">{t("project.new.public")}</option>
          </select>
        </div>
        {error ? (
          <Notice title={t("project.new.error")} tone="danger">
            {error}
          </Notice>
        ) : null}
        <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
          {t("project.new.create")}
        </Button>
      </form>
    </div>
  );
}
