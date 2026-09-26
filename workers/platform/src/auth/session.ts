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

export function requireOrigin(c: Context<AppEnv>, hasSession = false): boolean {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return true;
  }
  const path = new URL(c.req.url).pathname;
  if (path === GITHUB_WEBHOOK_PATH) return true;
  const origin = c.req.header("Origin");
  if (hasSession) return origin === c.env.APP_ORIGIN;
  if (!origin) return c.req.header("Sec-Fetch-Site") !== "cross-site";
  return origin === c.env.APP_ORIGIN;
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
