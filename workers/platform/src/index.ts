import { Hono, type Context } from "hono";
import type { AppEnv } from "./lib/http.js";
import { jsonErr } from "./lib/http.js";
import {
  GITHUB_WEBHOOK_PATH,
  isAllowedOrigin,
  loadSession,
  requireCsrf,
  requireOrigin,
} from "./auth/session.js";
import { timingSafeEqual } from "./lib/secret.js";
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
import { isIndexableHost, robotsTxt, sitemapXml } from "./lib/seo.js";
import { publicStaticKey, staticObjectResponse } from "./lib/static-files.js";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("requestId", newId("req"));
  await next();
  c.header("X-Request-Id", c.get("requestId"));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
});

app.use("/api/*", async (c, next) => {
  // Reflect allowlisted Origins (APP_ORIGIN, local Vite ports, this Worker host).
  const origin = c.req.header("Origin");
  if (origin && isAllowedOrigin(c.env, origin, c.req.url)) {
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

  const path = new URL(c.req.url).pathname;
  const isWebhook = path === GITHUB_WEBHOOK_PATH;
  if (!isWebhook && !requireOrigin(c, Boolean(session))) {
    return jsonErr(c, "CSRF_ORIGIN", "Origin not allowed", 403, {
      nextAction: "Call the API from the OCLaunch app origin only",
    });
  }
  if (!isWebhook && session && !(await requireCsrf(c))) {
    const csrfExempt = path.startsWith("/api/auth/passkey/");
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
  if (!(await maintenanceAuthorized(c))) {
    return jsonErr(c, "FORBIDDEN", "Maintenance endpoint is disabled", 403);
  }
  const result = await runCleanup(c.env);
  return c.json(result);
});

async function maintenanceAuthorized(c: Context<AppEnv>): Promise<boolean> {
  const expected = c.env.MAINTENANCE_SECRET;
  const provided = c.req.header("X-Maintenance-Secret") ?? "";
  if (!expected || !provided) return false;
  return timingSafeEqual(provided, expected);
}

// Worker-rendered public pages (also under run_worker_first)
app.route("/", publicRoutes);

app.get("/robots.txt", (c) => {
  const host = new URL(c.req.url).hostname;
  return c.body(robotsTxt(host), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/sitemap.xml", (c) => {
  const host = new URL(c.req.url).hostname;
  if (!isIndexableHost(host)) {
    return c.text("Not found", 404);
  }
  return c.body(sitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/", async (c) => {
  const file = await readPublishedFile(c, "/index.html");
  if (!file) {
    return c.text("OCLaunch UI assets not built. Run npm run build -w @oclaunch/web", 503);
  }
  return applyStagingRobots(file, isIndexableHost(new URL(c.req.url).hostname));
});

app.get("/index.html", (c) => servePublished(c, "/index.html"));
app.get("/favicon.svg", (c) => servePublished(c, "/favicon.svg"));
app.get("/assets/*", (c) => servePublished(c, new URL(c.req.url).pathname));

async function servePublished(c: Context<AppEnv>, pathname: string) {
  const file = await readPublishedFile(c, pathname);
  return file ?? c.text("Not found", 404);
}

async function readPublishedFile(c: Context<AppEnv>, pathname: string): Promise<Response | null> {
  const key = publicStaticKey(pathname);
  if (!key) return null;
  const fromR2 = await staticObjectResponse(c.env.STATIC, key);
  if (fromR2) return fromR2;
  if (!c.env.ASSETS) return null;
  const url = new URL(c.req.url);
  url.pathname = `/${key}`;
  url.search = "";
  const res = await c.env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  return res.ok ? res : null;
}

function applyStagingRobots(response: Response, indexable: boolean): Response {
  if (indexable) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "no-store");
  return new HTMLRewriter()
    .on('meta[name="robots"]', {
      element(element) {
        element.setAttribute("content", "noindex, nofollow");
      },
    })
    .transform(new Response(response.body, { status: response.status, headers }));
}

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
