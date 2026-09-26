/**
 * Public site files live in the STATIC R2 bucket.
 * Keys are object paths such as `assets/logo.svg` or `index.html`.
 */

const CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml; charset=utf-8",
};

/** Turn a request path into an R2 key, or null when the path is not a public file. */
export function publicStaticKey(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname.includes("\\") || pathname.includes("\0")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("..") || decoded.includes("//")) return null;
  const key = decoded.slice(1);
  if (!key || key.startsWith("api/") || key.startsWith("p/") || key.startsWith("r/")) return null;
  return key;
}

export function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function cacheControlForKey(key: string): string {
  if (key.startsWith("assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=0, must-revalidate";
}

export async function staticObjectResponse(
  bucket: R2Bucket | undefined,
  key: string,
): Promise<Response | null> {
  if (!bucket) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  const headers = new Headers();
  headers.set("Content-Type", contentTypeForKey(key));
  headers.set("Cache-Control", cacheControlForKey(key));
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(obj.body, { status: 200, headers });
}
