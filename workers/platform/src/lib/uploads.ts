import { DEFAULT_QUOTAS } from "@oclaunch/shared";
import { newId } from "./ids.js";
import { nowIso } from "./http.js";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === "RIFF" && webp === "WEBP";
}

function sampleText(bytes: Uint8Array): string {
  const slice = bytes.slice(0, 512);
  let text = "";
  for (const value of slice) text += String.fromCharCode(value);
  return text.toLowerCase();
}

export function looksLikeActiveContent(bytes: Uint8Array): boolean {
  const text = sampleText(bytes).trim();
  return (
    text.startsWith("<") ||
    text.includes("<svg") ||
    text.includes("<html") ||
    text.includes("<script") ||
    text.includes("<!doctype") ||
    text.includes("<?xml")
  );
}

export function sniffedImageMime(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, GIF)) return "image/gif";
  if (isWebp(bytes)) return "image/webp";
  return null;
}

export function detectUpload(
  bytes: Uint8Array,
  kind: "image" | "member",
): { mime: string } | { error: string } {
  if (looksLikeActiveContent(bytes)) {
    return { error: "HTML and SVG uploads are blocked" };
  }
  const image = sniffedImageMime(bytes);
  if (image) return { mime: image };
  if (kind === "image") {
    return { error: "Pin evidence must be a PNG, JPEG, GIF, or WebP image" };
  }
  const text = sampleText(bytes).trim();
  if (text.startsWith("{") || text.startsWith("[")) return { mime: "application/json" };
  const binary = bytes.some((value) => value === 0 || (value < 9 && value !== 0) || (value > 13 && value < 32));
  if (!binary) return { mime: "text/plain" };
  return { error: "Only images or text/json uploads allowed" };
}

export async function reserveArtifactBytes(
  db: D1Database,
  projectId: string,
  artifactId: string,
  bytes: number,
): Promise<boolean> {
  const cap = DEFAULT_QUOTAS.artifactBytesPerProjectPerMonth;
  if (bytes <= 0 || bytes > cap) return false;
  const month = new Date().toISOString().slice(0, 7);
  const result = await db
    .prepare(
      `INSERT INTO usage_ledger (id, project_id, job_id, resource, quantity, unit, source_key, created_at)
       SELECT ?, ?, NULL, 'artifact_bytes', ?, 'bytes', ?, ?
       WHERE (
         SELECT COALESCE(SUM(quantity), 0) FROM usage_ledger
         WHERE project_id = ? AND resource = 'artifact_bytes' AND created_at LIKE ?
       ) + ? <= ?`,
    )
    .bind(
      newId("use"),
      projectId,
      bytes,
      `artifact:${artifactId}`,
      nowIso(),
      projectId,
      `${month}%`,
      bytes,
      cap,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

const SERVED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/json",
  "text/plain",
  "text/css",
]);

export function artifactResponseHeaders(mime: string, filename?: string): Headers {
  const headers = new Headers();
  headers.set("content-type", SERVED_MIME.has(mime) ? mime : "application/octet-stream");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "sandbox");
  headers.set(
    "content-disposition",
    filename ? `attachment; filename="${filename}"` : "attachment",
  );
  return headers;
}
