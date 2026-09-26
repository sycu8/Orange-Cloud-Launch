import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { OC_BRAND_TOKENS } from "@oclaunch/shared";
import { api } from "../../lib/api";
import { Button, Notice } from "../../components/ui";
import type { ProjectDetail } from "./ProjectLayout";

type BrandRow = {
  id: string;
  version: number;
  approved_at: string | null;
  profile: Record<string, unknown>;
};

export function BrandPage() {
  const { id } = useParams();
  const { data } = useOutletContext<{ data: ProjectDetail }>();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [directions, setDirections] = useState<Array<{ id: string; label: string; summary: string }>>(
    [],
  );
  const [direction, setDirection] = useState<"warm-practical" | "crisp-utility">("warm-practical");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api<{
      brands: BrandRow[];
      directions: Array<{ id: string; label: string; summary: string }>;
    }>(`/api/projects/${id}/brands`);
    setBrands(res.brands);
    setDirections(res.directions);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function createVersion() {
    try {
      await api(`/api/projects/${id}/brands`, {
        method: "POST",
        body: JSON.stringify({
          purpose: data.project.purpose,
          audience: data.project.audience,
          tone: ["practical", "welcoming", "precise"],
          colors: {
            ink: OC_BRAND_TOKENS.ink,
            canvas: OC_BRAND_TOKENS.canvas,
            surface: OC_BRAND_TOKENS.surface,
            action: OC_BRAND_TOKENS.action,
            accent: OC_BRAND_TOKENS.accent,
            muted: OC_BRAND_TOKENS.muted,
          },
          direction,
        }),
      });
      setMessage("Candidate brand version created. Owner approval freezes it.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function approve(brandId: string) {
    try {
      await api(`/api/projects/${id}/brands/${brandId}/approve`, {
        method: "POST",
        body: "{}",
      });
      setMessage("Brand version approved. Later releases compare against this profile.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Brand workspace</h2>
      <p className="mt-1 text-sm text-muted">
        Choose a constrained direction, generate a versioned profile, then approve. OCLaunch never
        silently replaces your logo or identity.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {directions.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDirection(d.id as "warm-practical" | "crisp-utility")}
            className={`rounded-[16px] border p-4 text-left ${
              direction === d.id ? "border-action bg-orange-tint" : "border-border bg-surface"
            }`}
          >
            <p className="font-semibold">{d.label}</p>
            <p className="mt-1 text-sm text-muted">{d.summary}</p>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Button onClick={() => void createVersion()}>Create brand version</Button>
      </div>
      {message ? (
        <div className="mt-4">
          <Notice title="Brand update" tone="positive">
            {message}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice title="Error" tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
      <ul className="mt-6 space-y-3">
        {brands.map((b) => (
          <li key={b.id} className="rounded-[16px] border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Version {b.version}</p>
              <p className="text-sm text-muted">
                {b.approved_at ? `Approved ${b.approved_at}` : "Candidate"}
              </p>
            </div>
            {!b.approved_at ? (
              <Button className="mt-3" variant="secondary" onClick={() => void approve(b.id)}>
                Approve identity version
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
