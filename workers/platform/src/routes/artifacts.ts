import { Hono } from "hono";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId, sha256Hex } from "../lib/ids.js";
import { requireMember } from "../db/access.js";

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
  const mime = upload.type || "application/octet-stream";
  if (!mime.startsWith("image/") && mime !== "application/json" && mime !== "text/plain") {
    return jsonErr(c, "VALIDATION", "Only images or text/json uploads allowed", 400);
  }
  // Never serve uploaded HTML/SVG under platform origin as active content
  if (mime.includes("svg") || mime === "text/html") {
    return jsonErr(c, "VALIDATION", "SVG/HTML uploads are blocked on the platform origin", 400);
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
  const hash = await sha256Hex(buf);
  const id = newId("art");
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
  return new Response(obj.body, {
    headers: {
      "content-type": art.mime_type,
      "content-disposition": "attachment",
      "x-content-type-options": "nosniff",
    },
  });
});
