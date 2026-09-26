import { Hono } from "hono";
import { createBrandSchema, defaultBrandProfile, brandProfileToCss } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";

export const brandRoutes = new Hono<AppEnv>();

brandRoutes.get("/projects/:projectId/brands", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const rows = await c.env.DB.prepare(
    `SELECT id, version, approved_at, approved_by, created_at, profile_json
     FROM brand_versions WHERE project_id = ? ORDER BY version DESC`,
  )
    .bind(projectId)
    .all();
  return jsonOk(c, {
    brands: (rows.results ?? []).map((b) => ({
      ...b,
      profile: JSON.parse(String((b as { profile_json: string }).profile_json)),
      profile_json: undefined,
    })),
    directions: [
      {
        id: "warm-practical",
        label: "Warm practical",
        summary: "Canvas neutrals with orange next-actions and teal for verified outcomes.",
      },
      {
        id: "crisp-utility",
        label: "Crisp utility",
        summary: "Higher-contrast ink surfaces, restrained accent, denser spacing for tools.",
      },
    ],
  });
});

brandRoutes.post("/projects/:projectId/brands", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId, ["owner", "maintainer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Maintainer access required", 403);
  const parsed = createBrandSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  const base = defaultBrandProfile({
    purpose: parsed.data.purpose,
    audience: parsed.data.audience,
  });
  const profile = {
    ...base,
    tone: parsed.data.tone,
    colors: parsed.data.colors,
    direction: parsed.data.direction,
  };
  if (parsed.data.direction === "crisp-utility") {
    profile.colors.canvas = "#F3F5F4";
    profile.spacingScale = [4, 8, 12, 16, 20, 28, 40, 56];
  }
  const ver = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(version), 0) as v FROM brand_versions WHERE project_id = ?`,
  )
    .bind(projectId)
    .first<{ v: number }>();
  const version = (ver?.v ?? 0) + 1;
  const id = newId("brd");
  await c.env.DB.prepare(
    `INSERT INTO brand_versions (id, project_id, version, profile_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, version, JSON.stringify(profile), nowIso())
    .run();
  await audit(c, "brand.create", "brand_version", id, projectId);
  return jsonOk(
    c,
    {
      id,
      version,
      profile,
      css: brandProfileToCss(profile),
      tokensJson: profile,
    },
    201,
  );
});

brandRoutes.post("/projects/:projectId/brands/:brandId/approve", async (c) => {
  const projectId = c.req.param("projectId");
  const brandId = c.req.param("brandId");
  const role = await requireMember(c, projectId, ["owner"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Owner approval required", 403);
  const updated = await c.env.DB.prepare(
    `UPDATE brand_versions SET approved_by = ?, approved_at = ?
     WHERE project_id = ? AND id = ?`,
  )
    .bind(c.get("userId") ?? null, nowIso(), projectId, brandId)
    .run();
  if (!updated.meta.changes) return jsonErr(c, "NOT_FOUND", "Brand version not found", 404);
  await audit(c, "brand.approve", "brand_version", brandId, projectId);
  return jsonOk(c, { ok: true });
});
