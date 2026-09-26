import { Hono } from "hono";
import type { AppEnv } from "./lib/http.js";
import { jsonErr } from "./lib/http.js";
import { loadSession, requireCsrf, requireOrigin } from "./auth/session.js";
import { newId } from "./lib/ids.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { releaseRoutes } from "./routes/releases.js";
import { missionRoutes } from "./routes/missions.js";
import { findingRoutes } from "./routes/findings.js";
import { brandRoutes } from "./routes/brands.js";
import { changeRoutes } from "./routes/changes.js";
import { reportRoutes, publicRoutes } from "./routes/reports.js";
import { domainRoutes } from "./routes/domains.js";
import { integrationRoutes } from "./routes/integrations.js";
import { artifactRoutes } from "./routes/artifacts.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { relayOutbox } from "./jobs/outbox.js";
import { runCleanup } from "./jobs/cleanup.js";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("requestId", newId("req"));
  await next();
  c.header("X-Request-Id", c.get("requestId"));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
});

app.use("/api/*", async (c, next) => {
  // Same-origin API — reflect only configured APP_ORIGIN when CORS is needed for Vite dev proxy edge cases.
  const origin = c.req.header("Origin");
  if (origin && origin === c.env.APP_ORIGIN) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token",
    );
    c.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);

  const session = await loadSession(c);
  if (session) {
    c.set("userId", session.userId);
    c.set("csrfToken", session.csrfToken);
  }

  if (!requireOrigin(c)) {
    return jsonErr(c, "CSRF_ORIGIN", "Origin not allowed", 403, {
      nextAction: "Call the API from the OCLaunch app origin only",
    });
  }
  if (session && !(await requireCsrf(c))) {
    // Allow unauthenticated auth bootstrap + webhook without CSRF
    const path = new URL(c.req.url).pathname;
    const csrfExempt =
      path.startsWith("/api/auth/passkey/") ||
      path === "/api/auth/dev-login" ||
      path === "/api/auth/recovery/redeem" ||
      path === "/api/integrations/github/webhook";
    if (!csrfExempt && c.req.method !== "GET" && c.req.method !== "HEAD") {
      return jsonErr(c, "CSRF", "Missing or invalid CSRF token", 403, {
        nextAction: "Refresh the session and retry with X-CSRF-Token",
      });
    }
  }
  await next();
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "oclaunch-platform",
    env: c.env.APP_ENV,
    ruleset: c.env.RULESET_VERSION,
  }),
);

app.route("/api/auth", authRoutes);
app.route("/api", workspaceRoutes);
app.route("/api", projectRoutes);
app.route("/api", releaseRoutes);
app.route("/api", missionRoutes);
app.route("/api", findingRoutes);
app.route("/api", brandRoutes);
app.route("/api", changeRoutes);
app.route("/api", reportRoutes);
app.route("/api", domainRoutes);
app.route("/api", artifactRoutes);
app.route("/api/integrations", integrationRoutes);
app.route("/api", publicRoutes);

app.post("/api/internal/cleanup", async (c) => {
  if (c.env.APP_ENV === "production") {
    return jsonErr(c, "FORBIDDEN", "Use scheduled cron in production", 403);
  }
  const result = await runCleanup(c.env);
  return c.json(result);
});

// Worker-rendered public pages (also under run_worker_first)
app.route("/", publicRoutes);

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/")) {
    return jsonErr(c, "NOT_FOUND", "Not found", 404);
  }
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("OCLaunch UI assets not built. Run npm run build -w @oclaunch/web", 503);
});

app.onError((err, c) => {
  console.error("request_error", c.get("requestId"), err);
  return jsonErr(c, "INTERNAL", "Unexpected server error", 500, {
    retryable: true,
    nextAction: "Retry with the request id if the problem persists",
  });
});

import type { Env } from "./env.js";

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    await relayOutbox(env);
    await runCleanup(env);
  },
};
