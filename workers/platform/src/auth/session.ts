import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../lib/http.js";
import { newId, randomToken, sha256Hex } from "../lib/ids.js";
import { nowIso } from "../lib/http.js";
import { timingSafeEqual } from "../lib/secret.js";

export const GITHUB_WEBHOOK_PATH = "/api/integrations/github/webhook";

const SESSION_COOKIE = "oclaunch_session";
const SESSION_DAYS = 14;

function cookieOptions(c: Context<AppEnv>) {
  return {
    path: "/",
    httpOnly: true,
    secure: c.env.APP_ENV !== "development",
    sameSite: "Lax" as const,
  };
}

export async function createSession(
  c: Context<AppEnv>,
  userId: string,
): Promise<{ token: string; csrfToken: string }> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const csrfToken = randomToken(16);
  const id = newId("sess");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, tokenHash, csrfToken, expires, nowIso())
    .run();

  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOptions(c),
    expires: new Date(expires),
  });
  return { token, csrfToken };
}

export async function revokeAllSessions(c: Context<AppEnv>, userId: string): Promise<void> {
  await c.env.DB.prepare(
    `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
  )
    .bind(nowIso(), userId)
    .run();
}

export async function revokeSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Hex(token);
    const row = await c.env.DB.prepare(
      `SELECT user_id FROM sessions WHERE token_hash = ?`,
    )
      .bind(tokenHash)
      .first<{ user_id: string }>();
    if (row) await revokeAllSessions(c, row.user_id);
  }
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

export async function loadSession(
  c: Context<AppEnv>,
): Promise<{ userId: string; csrfToken: string } | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    `SELECT user_id, csrf_token, expires_at, revoked_at FROM sessions WHERE token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      user_id: string;
      csrf_token: string;
      expires_at: string;
      revoked_at: string | null;
    }>();
  if (!row || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { userId: row.user_id, csrfToken: row.csrf_token };
}

/** Origins permitted for CSRF and WebAuthn expectedOrigin checks. */
export function allowedOrigins(env: {
  APP_ORIGIN: string;
  APP_ENV: string;
  APP_ORIGINS_EXTRA?: string;
}): string[] {
  const origins = new Set<string>([env.APP_ORIGIN]);
  for (const extra of (env.APP_ORIGINS_EXTRA ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed.replace(/\/$/, ""));
  }
  if (env.APP_ENV === "development") {
    // Vite (`npm run dev`) proxies /api to wrangler on :8787 while the page is on :5173.
    for (const host of ["localhost", "127.0.0.1"]) {
      for (const port of ["5173", "8787"]) {
        origins.add(`http://${host}:${port}`);
      }
    }
  }
  return [...origins];
}

export function isAllowedOrigin(
  env: { APP_ORIGIN: string; APP_ENV: string; APP_ORIGINS_EXTRA?: string },
  origin: string | undefined,
  requestUrl: string,
): boolean {
  if (!origin) return false;
  const allowed = new Set(allowedOrigins(env));
  // Same Worker hostname as this request (covers workers.dev preview hosts).
  allowed.add(new URL(requestUrl).origin);
  return allowed.has(origin);
}

/**
 * CSRF origin gate. When Origin is present it must be an allowed app origin
 * (configured APP_ORIGIN, local Vite ports in development, or this request's origin).
 * Missing Origin is allowed only when Sec-Fetch-Site is not cross-site.
 */
export function requireOrigin(c: Context<AppEnv>, _hasSession = false): boolean {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return true;
  }
  const path = new URL(c.req.url).pathname;
  if (path === GITHUB_WEBHOOK_PATH) return true;
  const origin = c.req.header("Origin");
  if (!origin) return c.req.header("Sec-Fetch-Site") !== "cross-site";
  return isAllowedOrigin(c.env, origin, c.req.url);
}

/** Prefer the browser Origin when it is allowlisted; otherwise APP_ORIGIN. */
export function resolveCeremonyOrigin(c: Context<AppEnv>): string {
  const origin = c.req.header("Origin");
  if (origin && isAllowedOrigin(c.env, origin, c.req.url)) return origin;
  return c.env.APP_ORIGIN;
}

export async function requireCsrf(c: Context<AppEnv>): Promise<boolean> {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return true;
  }
  const header = c.req.header("X-CSRF-Token") ?? "";
  const expected = c.get("csrfToken") ?? "";
  if (!header || !expected) return false;
  return timingSafeEqual(header, expected);
}
