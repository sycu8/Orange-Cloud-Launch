import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import type { Env } from "../src/env.js";
import { REVIEW_SKILL_MD, sha256Prefixed } from "../src/lib/agent-discovery.js";

const env = {
  APP_ENV: "production",
  APP_ORIGIN: "https://launch.orangecloud.vn",
  WEBAUTHN_RP_ID: "launch.orangecloud.vn",
  ENABLE_PATCH_PR: "false",
  ENABLE_PROJECT_DOMAINS: "false",
  ENABLE_BROWSER_RUN: "false",
  ENABLE_WORKERS_AI: "false",
  RULESET_VERSION: "1.0.0",
} as Env;

const origin = "https://launch.orangecloud.vn";

async function get(path: string, init?: RequestInit) {
  return app.request(`${origin}${path}`, init, env);
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("agent discovery", () => {
  it("advertises machine-readable resources from the homepage", async () => {
    const res = await get("/");
    const link = res.headers.get("Link") ?? "";
    expect(link).toContain('</.well-known/api-catalog>; rel="api-catalog"');
    expect(link).toContain('rel="service-desc"');
    expect(link).toContain('rel="service-doc"');
    expect(link).toContain('rel="describedby"');
  });

  it("serves an RFC 9727 API catalog as linkset JSON", async () => {
    const res = await get("/.well-known/api-catalog");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/linkset+json");
    const body = await readJson<{ linkset: Array<Record<string, any>> }>(res);
    const entry = body.linkset[0];
    expect(entry).toBeTruthy();
    expect(entry?.anchor).toBe(`${origin}/api`);
    expect(entry?.["service-desc"][0].href).toBe(`${origin}/openapi.json`);
    expect(entry?.["service-doc"][0].href).toBe(`${origin}/docs/api`);
    expect(entry?.status[0].href).toBe(`${origin}/api/health`);
  });

  it("publishes OAuth metadata that matches the protected resource issuer", async () => {
    const resource = await readJson<Record<string, any>>(await get("/.well-known/oauth-protected-resource"));
    const auth = await readJson<Record<string, any>>(await get("/.well-known/oauth-authorization-server"));
    const oidc = await readJson<Record<string, any>>(await get("/.well-known/openid-configuration"));
    expect(resource.resource).toBe(`${origin}/api`);
    expect(resource.authorization_servers).toEqual([origin]);
    expect(resource.bearer_methods_supported).toContain("header");
    expect(resource.scopes_supported).toContain("public:read");
    expect(auth.issuer).toBe(resource.authorization_servers[0]);
    expect(auth.authorization_endpoint).toBe(`${origin}/oauth/authorize`);
    expect(auth.token_endpoint).toBe(`${origin}/oauth/token`);
    expect(auth.jwks_uri).toBe(`${origin}/.well-known/jwks.json`);
    expect(Array.isArray(auth.grant_types_supported)).toBe(true);
    expect(Array.isArray(auth.response_types_supported)).toBe(true);
    expect(auth.agent_auth.skill).toBe(`${origin}/auth.md`);
    expect(auth.agent_auth.register_uri).toBe(`${origin}/agent/register`);
    expect(auth.agent_auth.identity_types_supported).toContain("anonymous");
    expect(auth.agent_auth.anonymous.credential_types_supported).toContain("none");
    expect(auth.agent_auth.anonymous.claim_uri).toBe(`${origin}/agent/claim`);
    expect(oidc.issuer).toBe(auth.issuer);
    const jwks = await readJson<{ keys: unknown[] }>(await get("/.well-known/jwks.json"));
    expect(jwks.keys).toEqual([]);
  });

  it("serves Auth.md with the expected heading and does not issue a secret", async () => {
    const res = await get("/auth.md");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    const markdown = await res.text();
    expect(markdown.startsWith("# Auth.md")).toBe(true);
    const registered = await get("/agent/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "anonymous" }),
    });
    const registration = await readJson<Record<string, unknown>>(registered);
    expect(registration.credential_type).toBe("none");
    expect(registration.token_required).toBe(false);
    expect(registration).not.toHaveProperty("access_token");
    expect(registration).not.toHaveProperty("client_secret");
    const token = await get("/oauth/token", { method: "POST" });
    expect(token.status).toBe(400);
    const tokenBody = await readJson<{ error: string }>(token);
    expect(tokenBody.error).toBe("unsupported_grant_type");
    const docs = await get("/docs/api");
    expect(docs.status).toBe(200);
    expect(docs.headers.get("Content-Type")).toContain("text/html");
  });

  it("serves the MCP server card and a public tools list", async () => {
    const cardRes = await get("/.well-known/mcp/server-card.json");
    expect(cardRes.status).toBe(200);
    expect(cardRes.headers.get("Content-Type")).toContain("application/json");
    const card = await readJson<Record<string, any>>(cardRes);
    expect(card.serverInfo.name).toBe("oclaunch");
    expect(card.serverInfo.version).toBeTruthy();
    expect(card.transport.endpoint).toBe("/mcp");
    expect(card.capabilities.tools).toBeTruthy();
    const rpc = await get("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(rpc.status).toBe(200);
    const body = await readJson<{ result: { tools: Array<{ name: string }> } }>(rpc);
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain("list_public_projects");
    expect(names).toContain("get_health");
  });

  it("publishes a skills index whose digests match the skill files", async () => {
    const res = await get("/.well-known/agent-skills/index.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const index = await readJson<{
      $schema: string;
      skills: Array<{ name: string; type: string; digest: string }>;
    }>(res);
    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    expect(index.skills.length).toBeGreaterThan(0);
    for (const skill of index.skills) {
      expect(skill.type).toBe("skill-md");
      expect(skill.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
      const artifact = await get(`/.well-known/agent-skills/${skill.name}/SKILL.md`);
      expect(artifact.status).toBe(200);
      expect(artifact.headers.get("Content-Type")).toContain("text/markdown");
      const body = await artifact.text();
      expect(await sha256Prefixed(body)).toBe(skill.digest);
      expect(body).toContain(`name: ${skill.name}`);
    }
    const review = index.skills.find((skill) => skill.name === "review-a-release");
    expect(review).toBeTruthy();
    expect(await sha256Prefixed(REVIEW_SKILL_MD)).toBe(review?.digest);
  });

  it("serves an ARD catalog as JSON with CORS", async () => {
    const res = await get("/.well-known/ai-catalog.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const catalog = await readJson<{
      specVersion: string;
      host: { displayName: string; identifier: string };
      entries: Array<{
        identifier: string;
        displayName: string;
        type: string;
        url?: string;
        data?: unknown;
        representativeQueries: string[];
      }>;
    }>(res);
    expect(catalog.specVersion).toBe("1.0");
    expect(catalog.host.displayName).toBe("OCLaunch");
    expect(catalog.host.identifier).toBe("did:web:launch.orangecloud.vn");
    expect(catalog.entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:launch\.orangecloud\.vn:/);
      expect(entry.displayName).toBeTruthy();
      expect(entry.type).toContain("/");
      expect(Boolean(entry.url) !== Boolean(entry.data)).toBe(true);
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2);
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5);
    }
  });

  it("points unauthenticated API calls at protected resource metadata", async () => {
    const res = await get("/api/auth/me");
    expect(res.status).toBe(401);
    const challenge = res.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toContain('resource_metadata="https://launch.orangecloud.vn/.well-known/oauth-protected-resource"');
  });

  it("keeps the DNS-AID zone file ready for the public hostnames", () => {
    const zone = readFileSync(new URL("../../../dns/oclaunch-agents.zone", import.meta.url), "utf8");
    expect(zone).toContain("_index._agents.launch");
    expect(zone).toContain("_mcp._agents.launch");
    expect(zone).toContain('alpn="h2"');
    expect(zone).toContain("port=443");
    expect(zone).toContain("IN SVCB");
    expect(zone).toContain("IN HTTPS");
    expect(zone).toContain("url=https://launch.orangecloud.vn/.well-known/ai-catalog.json");
    expect(zone).toContain("DNSSEC");
  });
});
