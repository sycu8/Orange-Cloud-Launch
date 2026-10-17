import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";
import {
  agentSkillsIndex,
  aiCatalog,
  anonymousClaim,
  anonymousRegistration,
  apiCatalog,
  apiDocsHtml,
  API_CATALOG_PROFILE,
  authMarkdown,
  mcpServerCard,
  oauthAuthorizationServer,
  openApiDocument,
  openIdConfiguration,
  protectedResourceMetadata,
  requestOrigin,
  skillMarkdown,
} from "../lib/agent-discovery.js";
import { handleMcp } from "./mcp.js";

export const discoveryRoutes = new Hono<AppEnv>();

discoveryRoutes.options("/.well-known/*", (c) => emptyCors(c));
discoveryRoutes.options("/auth.md", (c) => emptyCors(c));
discoveryRoutes.options("/openapi.json", (c) => emptyCors(c));
discoveryRoutes.options("/docs/*", (c) => emptyCors(c));
discoveryRoutes.options("/agent/*", (c) => emptyCors(c));
discoveryRoutes.options("/oauth/*", (c) => emptyCors(c));
discoveryRoutes.options("/mcp", (c) => handleMcp(c));

discoveryRoutes.get("/.well-known/api-catalog", (c) => {
  const body = apiCatalog(requestOrigin(c.req.url));
  return publish(c, JSON.stringify(body), "application/linkset+json", {
    Link: `<${API_CATALOG_PROFILE}>; rel="profile"`,
  });
});

discoveryRoutes.get("/openapi.json", (c) =>
  publish(c, JSON.stringify(openApiDocument(requestOrigin(c.req.url))), "application/vnd.oai.openapi+json"),
);

discoveryRoutes.get("/docs/api", (c) =>
  publish(c, apiDocsHtml(requestOrigin(c.req.url)), "text/html; charset=utf-8"),
);

discoveryRoutes.get("/.well-known/oauth-authorization-server", (c) =>
  publish(c, JSON.stringify(oauthAuthorizationServer(requestOrigin(c.req.url))), "application/json"),
);

discoveryRoutes.get("/.well-known/openid-configuration", (c) =>
  publish(c, JSON.stringify(openIdConfiguration(requestOrigin(c.req.url))), "application/json"),
);

discoveryRoutes.get("/.well-known/oauth-protected-resource", (c) =>
  publish(c, JSON.stringify(protectedResourceMetadata(requestOrigin(c.req.url))), "application/json"),
);

discoveryRoutes.get("/.well-known/jwks.json", (c) =>
  publish(c, JSON.stringify({ keys: [] }), "application/json"),
);

discoveryRoutes.get("/auth.md", (c) =>
  publish(c, authMarkdown(requestOrigin(c.req.url)), "text/markdown; charset=utf-8"),
);

discoveryRoutes.on(["GET", "POST"], "/agent/register", async (c) => {
  const origin = requestOrigin(c.req.url);
  if (c.req.method === "POST") {
    const parsed = await readJsonObject(c);
    if (!parsed.ok) return parsed.response;
    const type = parsed.body.type;
    if (type !== undefined && type !== "anonymous") {
      return publish(
        c,
        JSON.stringify({
          error: "unsupported_identity_type",
          error_description: "OCLaunch anonymous registration is the only agent method. It does not issue a secret.",
        }),
        "application/json",
        { "Cache-Control": "no-store" },
        400,
      );
    }
  }
  return publish(c, JSON.stringify(anonymousRegistration(origin)), "application/json", {
    "Cache-Control": "no-store",
  });
});

discoveryRoutes.on(["GET", "POST"], "/agent/claim", (c) =>
  publish(c, JSON.stringify(anonymousClaim(requestOrigin(c.req.url))), "application/json", {
    "Cache-Control": "no-store",
  }),
);

discoveryRoutes.on(["GET", "POST"], "/oauth/authorize", (c) =>
  publish(
    c,
    JSON.stringify({
      error: "interaction_required",
      error_description:
        "OCLaunch signs founders in with a passkey at /signin. This server does not complete an OAuth authorization grant. Read /auth.md.",
      authorization_page: `${requestOrigin(c.req.url)}/signin`,
    }),
    "application/json",
    { "Cache-Control": "no-store" },
    400,
  ),
);

discoveryRoutes.on(["GET", "POST"], "/oauth/token", (c) =>
  publish(
    c,
    JSON.stringify({
      error: "unsupported_grant_type",
      error_description:
        "OCLaunch does not issue OAuth access tokens. Public reads need no credential. Private APIs use a passkey session. See /auth.md.",
    }),
    "application/json",
    { "Cache-Control": "no-store" },
    400,
  ),
);

discoveryRoutes.get("/.well-known/mcp/server-card.json", (c) =>
  publish(c, JSON.stringify(mcpServerCard(requestOrigin(c.req.url))), "application/json"),
);

discoveryRoutes.on(["GET", "POST"], "/mcp", (c) => handleMcp(c));

discoveryRoutes.get("/.well-known/agent-skills/index.json", async (c) => {
  const index = await agentSkillsIndex(requestOrigin(c.req.url));
  return publish(c, JSON.stringify(index), "application/json");
});

discoveryRoutes.get("/.well-known/agent-skills/:name/SKILL.md", (c) => {
  const body = skillMarkdown(c.req.param("name"));
  if (!body) return c.text("Not found", 404);
  return publish(c, body, "text/markdown; charset=utf-8");
});

discoveryRoutes.get("/.well-known/ai-catalog.json", (c) =>
  publish(c, JSON.stringify(aiCatalog(requestOrigin(c.req.url))), "application/json"),
);

function publish(
  c: Context<AppEnv>,
  body: string,
  contentType: string,
  extra?: Record<string, string>,
  status: 200 | 400 = 200,
) {
  return c.body(body, status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Cache-Control": "public, max-age=300",
    ...extra,
  });
}

function emptyCors(c: Context<AppEnv>) {
  return c.body(null, 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
  });
}

async function readJsonObject(
  c: Context<AppEnv>,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const text = await c.req.text();
  if (!text) return { ok: true, body: {} };
  if (text.length > 64 * 1024) {
    return {
      ok: false,
      response: publish(
        c,
        JSON.stringify({ error: "invalid_request", error_description: "Request body is too large" }),
        "application/json",
        { "Cache-Control": "no-store" },
        400,
      ),
    };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        response: publish(
          c,
          JSON.stringify({ error: "invalid_request", error_description: "Expected a JSON object" }),
          "application/json",
          { "Cache-Control": "no-store" },
          400,
        ),
      };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: publish(
        c,
        JSON.stringify({ error: "invalid_request", error_description: "Invalid JSON" }),
        "application/json",
        { "Cache-Control": "no-store" },
        400,
      ),
    };
  }
}
