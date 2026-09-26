import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button, Input, Label, Notice, TextArea } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

export function ProjectSettingsPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, reload } = useOutletContext<{
    data: ProjectDetail;
    reload: () => Promise<void>;
  }>();
  const [form, setForm] = useState({
    visibility: data.project.visibility,
    liveUrl: data.project.live_url ?? "",
    audience: data.project.audience,
    primaryTask: data.project.primary_task ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          visibility: form.visibility,
          liveUrl: form.liveUrl,
          audience: form.audience,
          primaryTask: form.primaryTask,
        }),
      });
      setMessage(t("common.saved"));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">{t("settings.title")}</h2>
      <p className="text-sm text-muted">{t("settings.subtitle")}</p>
      <div>
        <Label>{t("settings.visibility")}</Label>
        <select
          className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
          value={form.visibility}
          onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
        >
          <option value="private">{t("settings.private")}</option>
          <option value="unlisted">{t("settings.unlisted")}</option>
          <option value="public">{t("settings.public")}</option>
        </select>
      </div>
      <div>
        <Label>{t("settings.liveUrl")}</Label>
        <Input
          type="url"
          value={form.liveUrl}
          onChange={(e) => setForm((f) => ({ ...f, liveUrl: e.target.value }))}
        />
      </div>
      <div>
        <Label>{t("settings.audience")}</Label>
        <Input
          value={form.audience}
          onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
          required
        />
      </div>
      <div>
        <Label>{t("settings.primaryTask")}</Label>
        <TextArea
          value={form.primaryTask}
          onChange={(e) => setForm((f) => ({ ...f, primaryTask: e.target.value }))}
        />
      </div>
      <Button type="submit">{t("settings.save")}</Button>
      {message ? (
        <Notice title={t("common.update")} tone="positive">
          {message}
        </Notice>
      ) : null}
      {error ? (
        <Notice title={t("common.error")} tone="danger">
          {error}
        </Notice>
      ) : null}
    </form>
  );
}
