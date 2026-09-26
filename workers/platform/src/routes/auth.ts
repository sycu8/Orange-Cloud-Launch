import { Hono } from "hono";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk } from "../lib/http.js";
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
  devLogin,
} from "../auth/passkeys.js";
import { revokeSession } from "../auth/session.js";

export const authRoutes = new Hono<AppEnv>();

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
      devAuthBypass: c.env.DEV_AUTH_BYPASS === "true" && c.env.APP_ENV !== "production",
    },
  });
});

authRoutes.post("/passkey/register/options", async (c) => {
  const body = await c.req.json<{ displayName?: string }>().catch(() => ({}));
  const displayName = (body as { displayName?: string }).displayName?.trim();
  if (!displayName) {
    return jsonErr(c, "VALIDATION", "displayName is required", 400);
  }
  const result = await registrationOptions(c, displayName);
  return jsonOk(c, result);
});

authRoutes.post("/passkey/register/verify", async (c) => {
  const body = await c.req.json<{ challengeId: string; response: unknown }>();
  if (!body.challengeId || !body.response) {
    return jsonErr(c, "VALIDATION", "challengeId and response are required", 400);
  }
  const result = await verifyRegistration(c, body);
  if (!result.ok) {
    return jsonErr(c, "AUTH_FAILED", result.error, 400, {
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
  const result = await authenticationOptions(c);
  return jsonOk(c, result);
});

authRoutes.post("/passkey/login/verify", async (c) => {
  const body = await c.req.json<{ challengeId: string; response: unknown }>();
  const result = await verifyAuthentication(c, body);
  if (!result.ok) {
    return jsonErr(c, "AUTH_FAILED", result.error, 401, {
      nextAction: "Retry passkey sign-in or use a recovery code later",
    });
  }
  return jsonOk(c, { userId: result.userId, csrfToken: result.csrfToken });
});

authRoutes.post("/dev-login", async (c) => {
  const body = await c.req.json<{ displayName?: string }>().catch(() => ({}));
  const displayName =
    (body as { displayName?: string }).displayName?.trim() || "Local Founder";
  const result = await devLogin(c, displayName);
  if (!result.ok) {
    return jsonErr(c, "DEV_AUTH_DISABLED", "Dev login is disabled in this environment", 403);
  }
  return jsonOk(c, result);
});

authRoutes.post("/logout", async (c) => {
  await revokeSession(c);
  return jsonOk(c, { ok: true });
});
