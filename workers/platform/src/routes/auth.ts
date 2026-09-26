import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
  devLogin,
  devLoginPermitted,
} from "../auth/passkeys.js";
import { createSession, revokeAllSessions, revokeSession } from "../auth/session.js";
import { hmacSha256Hex } from "../lib/secret.js";
import { consumeRate, overRate } from "../lib/rate-limit.js";

export const authRoutes = new Hono<AppEnv>();

const MAX_AUTH_JSON = 64 * 1024;
const AUTH_WINDOW_MS = 10 * 60_000;
const AUTH_ATTEMPTS = 20;
const CHALLENGE_ATTEMPTS = 8;
const RECOVERY_FAILS = 5;
const RECOVERY_WINDOW_MS = 15 * 60_000;
const DISPLAY_NAME_MAX = 80;

function clientAddress(c: Context<AppEnv>): string {
  return (c.req.header("CF-Connecting-IP") ?? "local").trim().slice(0, 64) || "local";
}

async function limitAuth(
  c: Context<AppEnv>,
  route: string,
  challengeId?: string,
): Promise<Response | null> {
  const ip = clientAddress(c);
  const allowed = await consumeRate(
    c.env.DB,
    `auth:${route}:${ip}`,
    AUTH_ATTEMPTS,
    AUTH_WINDOW_MS,
  );
  if (!allowed) {
    return jsonErr(c, "RATE_LIMITED", "Too many attempts. Try again later.", 429, {
      retryable: true,
    });
  }
  if (challengeId) {
    const challengeAllowed = await consumeRate(
      c.env.DB,
      `auth:challenge:${challengeId}`,
      CHALLENGE_ATTEMPTS,
      AUTH_WINDOW_MS,
    );
    if (!challengeAllowed) {
      return jsonErr(c, "RATE_LIMITED", "Too many attempts. Try again later.", 429, {
        retryable: true,
      });
    }
  }
  return null;
}

async function readAuthJson(
  c: Context<AppEnv>,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const text = await c.req.text();
  if (text.length > MAX_AUTH_JSON) {
    return { ok: false, response: jsonErr(c, "VALIDATION", "Request body is too large", 413) };
  }
  if (!text) return { ok: true, body: {} };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, response: jsonErr(c, "VALIDATION", "Invalid JSON", 400) };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonErr(c, "VALIDATION", "Invalid JSON", 400) };
  }
}

function devLoginAvailable(c: Context<AppEnv>): boolean {
  return devLoginPermitted({
    appEnv: c.env.APP_ENV,
    requestHostname: new URL(c.req.url).hostname,
    hostHeader: c.req.header("Host") ?? "",
    secretConfigured: Boolean(c.env.DEV_LOGIN_SECRET),
  });
}

authRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return jsonErr(c, "UNAUTHENTICATED", "Sign in required", 401, {
      nextAction: "Use passkey sign-in or labeled local dev login",
    });
  }
  const user = await c.env.DB.prepare(
    `SELECT id, display_name, created_at FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first();
  return jsonOk(c, {
    user,
    csrfToken: c.get("csrfToken"),
    integrations: {
      github: Boolean(c.env.GITHUB_APP_ID),
      browserRun: c.env.ENABLE_BROWSER_RUN === "true",
      workersAi: c.env.ENABLE_WORKERS_AI === "true",
      patchPr: c.env.ENABLE_PATCH_PR === "true",
      projectDomains: c.env.ENABLE_PROJECT_DOMAINS === "true",
      devAuthBypass: devLoginAvailable(c),
    },
  });
});

authRoutes.post("/passkey/register/options", async (c) => {
  const limited = await limitAuth(c, "register-options");
  if (limited) return limited;
  const parsed = await readAuthJson(c);
  if (!parsed.ok) return parsed.response;
  const displayName = String(parsed.body.displayName ?? "").trim();
  if (!displayName || displayName.length > DISPLAY_NAME_MAX) {
    return jsonErr(c, "VALIDATION", "displayName must be 1-80 characters", 400);
  }
  const result = await registrationOptions(c, displayName);
  return jsonOk(c, result);
});

authRoutes.post("/passkey/register/verify", async (c) => {
  const parsed = await readAuthJson(c);
  if (!parsed.ok) return parsed.response;
  const challengeId = String(parsed.body.challengeId ?? "");
  const limited = await limitAuth(c, "register-verify", challengeId || undefined);
  if (limited) return limited;
  if (!challengeId || !parsed.body.response) {
    return jsonErr(c, "VALIDATION", "challengeId and response are required", 400);
  }
  const result = await verifyRegistration(c, {
    challengeId,
    response: parsed.body.response,
  });
  if (!result.ok) {
    const status = result.error === "recovery_not_configured" ? 503 : 400;
    return jsonErr(c, "AUTH_FAILED", result.error, status, {
      nextAction: "Retry passkey registration",
    });
  }
  return jsonOk(c, {
    userId: result.userId,
    csrfToken: result.csrfToken,
    recoveryCodes: result.recoveryCodes,
  });
});

authRoutes.post("/passkey/login/options", async (c) => {
  const limited = await limitAuth(c, "login-options");
  if (limited) return limited;
  const result = await authenticationOptions(c);
  return jsonOk(c, result);
});

authRoutes.post("/passkey/login/verify", async (c) => {
  const parsed = await readAuthJson(c);
  if (!parsed.ok) return parsed.response;
  const challengeId = String(parsed.body.challengeId ?? "");
  const limited = await limitAuth(c, "login-verify", challengeId || undefined);
  if (limited) return limited;
  const result = await verifyAuthentication(c, {
    challengeId,
    response: parsed.body.response,
  });
  if (!result.ok) {
    return jsonErr(c, "AUTH_FAILED", result.error, 401, {
      nextAction: "Retry passkey sign-in or use a recovery code later",
    });
  }
  return jsonOk(c, { userId: result.userId, csrfToken: result.csrfToken });
});

authRoutes.post("/dev-login", async (c) => {
  const limited = await limitAuth(c, "dev-login");
  if (limited) return limited;
  const parsed = await readAuthJson(c);
  if (!parsed.ok) return parsed.response;
  const secret = String(parsed.body.secret ?? "");
  const result = await devLogin(c, secret);
  if (!result.ok) {
    return jsonErr(c, "DEV_AUTH_DISABLED", "Dev login is disabled in this environment", 403);
  }
  return jsonOk(c, result);
});

authRoutes.post("/logout", async (c) => {
  await revokeSession(c);
  return jsonOk(c, { ok: true });
});

/** Single-use recovery code login. Codes are HMAC-SHA256 with SESSION_SECRET. */
authRoutes.post("/recovery/redeem", async (c) => {
  const limited = await limitAuth(c, "recovery");
  if (limited) return limited;
  const ip = clientAddress(c);
  const failBucket = `auth:recovery-fail:${ip}`;
  if (await overRate(c.env.DB, failBucket, RECOVERY_FAILS, RECOVERY_WINDOW_MS)) {
    return jsonErr(c, "RATE_LIMITED", "Too many attempts. Try again later.", 429, {
      retryable: true,
    });
  }
  if (!c.env.SESSION_SECRET) {
    return jsonErr(c, "INTEGRATION_NOT_CONFIGURED", "Recovery is not configured", 503);
  }
  const parsed = await readAuthJson(c);
  if (!parsed.ok) return parsed.response;
  const code = String(parsed.body.code ?? "").trim();
  if (!code || code.length > 128) return jsonErr(c, "VALIDATION", "code is required", 400);
  const hash = await hmacSha256Hex(c.env.SESSION_SECRET, code);
  const row = await c.env.DB.prepare(
    `SELECT id, user_id FROM recovery_codes WHERE code_hash = ? AND used_at IS NULL`,
  )
    .bind(hash)
    .first<{ id: string; user_id: string }>();
  if (!row) {
    await consumeRate(c.env.DB, failBucket, RECOVERY_FAILS, RECOVERY_WINDOW_MS);
    return jsonErr(c, "AUTH_FAILED", "Invalid or already used recovery code", 401, {
      nextAction: "Use a remaining unused recovery code or register a new passkey while signed in",
    });
  }
  const consumed = await c.env.DB.prepare(
    `UPDATE recovery_codes SET used_at = ? WHERE id = ? AND used_at IS NULL`,
  )
    .bind(nowIso(), row.id)
    .run();
  if (!consumed.meta.changes) {
    await consumeRate(c.env.DB, failBucket, RECOVERY_FAILS, RECOVERY_WINDOW_MS);
    return jsonErr(c, "AUTH_FAILED", "Invalid or already used recovery code", 401);
  }
  await revokeAllSessions(c, row.user_id);
  const session = await createSession(c, row.user_id);
  return jsonOk(c, { userId: row.user_id, csrfToken: session.csrfToken });
});
