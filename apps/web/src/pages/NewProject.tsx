import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Input, Label, Notice, PageHeader, TextArea } from "../components/ui";

export function NewProjectPage() {
  const { me, loading } = useAuth();
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

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me) return <Navigate to="/signin" replace />;

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
      <PageHeader
        title="Add your project"
        subtitle="Visibility defaults to private. Public directory listing is opt-in."
      />
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            required
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                slug:
                  f.slug ||
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .slice(0, 48),
              }))
            }
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input
            required
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </div>
        <div>
          <Label>Purpose</Label>
          <TextArea
            required
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <div>
          <Label>Target audience</Label>
          <Input
            required
            value={form.audience}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
          />
        </div>
        <div>
          <Label>Primary user task</Label>
          <Input
            value={form.primaryTask}
            onChange={(e) => setForm((f) => ({ ...f, primaryTask: e.target.value }))}
            placeholder="Create your first weekly plan without help"
          />
        </div>
        <div>
          <Label>Live URL</Label>
          <Input
            type="url"
            value={form.liveUrl}
            onChange={(e) => setForm((f) => ({ ...f, liveUrl: e.target.value }))}
            placeholder="https://"
          />
        </div>
        <div>
          <Label>Visibility</Label>
          <select
            className="min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3"
            value={form.visibility}
            onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted (passport link only)</option>
            <option value="public">Public (discoverable)</option>
          </select>
        </div>
        {error ? (
          <Notice title="Could not create project" tone="danger">
            {error}
          </Notice>
        ) : null}
        <Button type="submit" disabled={busy}>
          Create project
        </Button>
      </form>
    </div>
  );
}
