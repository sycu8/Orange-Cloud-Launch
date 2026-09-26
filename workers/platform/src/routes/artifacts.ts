import { Hono } from "hono";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId, sha256Hex } from "../lib/ids.js";
import { requireMember } from "../db/access.js";
import { artifactResponseHeaders, detectUpload, reserveArtifactBytes } from "../lib/uploads.js";

const MAX_BYTES = 2_000_000;

export const artifactRoutes = new Hono<AppEnv>();

artifactRoutes.post("/projects/:projectId/artifacts", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId, ["owner", "maintainer", "reviewer"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);

  const form = await c.req.formData();
  const file = form.get("file");
  const releaseId = String(form.get("releaseId") || "") || null;
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return jsonErr(c, "VALIDATION", "file is required", 400);
  }
  const upload = file as File;
  if (upload.size > MAX_BYTES) {
    return jsonErr(c, "VALIDATION", "File exceeds 2MB upload cap", 400);
  }
  if (releaseId) {
    const rel = await c.env.DB.prepare(
      `SELECT id FROM releases WHERE project_id = ? AND id = ?`,
    )
      .bind(projectId, releaseId)
      .first();
    if (!rel) return jsonErr(c, "VALIDATION", "releaseId not in project", 400);
  }

  const buf = await upload.arrayBuffer();
  const detected = detectUpload(new Uint8Array(buf), "member");
  if ("error" in detected) return jsonErr(c, "VALIDATION", detected.error, 400);
  const mime = detected.mime;
  const hash = await sha256Hex(buf);
  const id = newId("art");
  const reserved = await reserveArtifactBytes(c.env.DB, projectId, id, upload.size);
  if (!reserved) {
    return jsonErr(c, "QUOTA_EXCEEDED", "Project upload quota for this month is full", 429, {
      nextAction: "Remove unused evidence or wait until next month",
    });
  }
  const key = `projects/${projectId}/releases/${releaseId ?? "none"}/evidence/${id}`;
  await c.env.ARTIFACTS.put(key, buf, {
    httpMetadata: { contentType: mime },
  });
  await c.env.DB.prepare(
    `INSERT INTO artifacts (id, project_id, release_id, r2_key, sha256, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, releaseId, key, hash, mime, upload.size, nowIso())
    .run();
  return jsonOk(c, { id, sha256: hash, sizeBytes: upload.size, mimeType: mime }, 201);
});

artifactRoutes.get("/projects/:projectId/artifacts/:artifactId", async (c) => {
  const projectId = c.req.param("projectId");
  const artifactId = c.req.param("artifactId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const art = await c.env.DB.prepare(
    `SELECT r2_key, mime_type FROM artifacts WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, artifactId)
    .first<{ r2_key: string; mime_type: string }>();
  if (!art) return jsonErr(c, "NOT_FOUND", "Artifact not found", 404);
  const obj = await c.env.ARTIFACTS.get(art.r2_key);
  if (!obj) return jsonErr(c, "NOT_FOUND", "Object missing", 404);
  return new Response(obj.body, { headers: artifactResponseHeaders(art.mime_type) });
});
