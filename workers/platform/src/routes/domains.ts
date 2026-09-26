import { Hono } from "hono";
import { createDomainSchema } from "@oclaunch/shared";
import type { AppEnv } from "../lib/http.js";
import { jsonErr, jsonOk, nowIso } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { audit, requireMember } from "../db/access.js";
import {
  createChallenge,
  isBlockedUpstream,
  isReservedHostname,
} from "../integrations/domains.js";
import { assessOutboundUrl } from "../lib/fetch-guard.js";
import { timingSafeEqual } from "../lib/secret.js";

export const domainRoutes = new Hono<AppEnv>();

domainRoutes.get("/projects/:projectId/domains", async (c) => {
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId);
  if (!role) return jsonErr(c, "FORBIDDEN", "No access", 403);
  const rows = await c.env.DB.prepare(
    `SELECT id, hostname, upstream_url, state, verified_at, created_at FROM domains WHERE project_id = ?`,
  )
    .bind(projectId)
    .all();
  return jsonOk(c, {
    domains: rows.results ?? [],
    enabled: c.env.ENABLE_PROJECT_DOMAINS === "true",
  });
});

domainRoutes.post("/projects/:projectId/domains", async (c) => {
  if (c.env.ENABLE_PROJECT_DOMAINS !== "true") {
    return jsonErr(c, "INTEGRATION_NOT_CONFIGURED", "Project domains are not enabled", 503, {
      nextAction: "Turn on ENABLE_PROJECT_DOMAINS only with an approved DNS plan",
    });
  }
  const projectId = c.req.param("projectId");
  const role = await requireMember(c, projectId, ["owner"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Owner access required", 403);
  const parsed = createDomainSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return jsonErr(c, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid", 400);
  }
  if (isReservedHostname(parsed.data.hostname)) {
    return jsonErr(c, "VALIDATION", "Hostname slug is reserved", 400);
  }
  const upstream = isBlockedUpstream(parsed.data.upstreamUrl);
  if (!upstream.ok) return jsonErr(c, "VALIDATION", upstream.reason, 400);
  const resolved = await assessOutboundUrl(parsed.data.upstreamUrl, { allowLoopback: false });
  if (!resolved.ok) {
    return jsonErr(c, "VALIDATION", "Upstream host is not allowed", 400);
  }

  const challenge = await createChallenge();
  const id = newId("dom");
  const gatewayEnabled = c.env.ENABLE_PROJECT_DOMAINS === "true";
  try {
    await c.env.DB.prepare(
      `INSERT INTO domains (
        id, project_id, hostname, upstream_url, state, challenge_nonce, challenge_hash,
        challenge_expires_at, version, created_at
      ) VALUES (?, ?, ?, ?, 'ownership_pending', ?, ?, ?, 1, ?)`,
    )
      .bind(
        id,
        projectId,
        parsed.data.hostname,
        parsed.data.upstreamUrl,
        challenge.nonce,
        challenge.hash,
        challenge.expiresAt,
        nowIso(),
      )
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("UNIQUE")) {
      return jsonErr(c, "CONFLICT", "Hostname already claimed", 409);
    }
    throw err;
  }
  await audit(c, "domain.request", "domain", id, projectId);
  return jsonOk(
    c,
    {
      id,
      state: "ownership_pending",
      gatewayEnabled,
      verification: {
        path: "/.well-known/oclaunch-verification",
        body: challenge.nonce,
        expiresAt: challenge.expiresAt,
      },
      note: gatewayEnabled
        ? "Serve the nonce on the upstream origin, then call verify. Live DNS attach still needs owner approval."
        : "Ownership challenge recorded. Live DNS/gateway activation remains integration_not_configured until ENABLE_PROJECT_DOMAINS and deploy approval.",
    },
    201,
  );
});

domainRoutes.post("/projects/:projectId/domains/:domainId/verify", async (c) => {
  if (c.env.ENABLE_PROJECT_DOMAINS !== "true") {
    return jsonErr(c, "INTEGRATION_NOT_CONFIGURED", "Project domains are not enabled", 503, {
      nextAction: "Turn on ENABLE_PROJECT_DOMAINS only with an approved DNS plan",
    });
  }
  const projectId = c.req.param("projectId");
  const domainId = c.req.param("domainId");
  const role = await requireMember(c, projectId, ["owner"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Owner access required", 403);
  const domain = await c.env.DB.prepare(
    `SELECT * FROM domains WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, domainId)
    .first<{
      hostname: string;
      challenge_nonce: string | null;
      challenge_expires_at: string | null;
      state: string;
    }>();
  if (!domain) return jsonErr(c, "NOT_FOUND", "Domain claim not found", 404);
  if (!domain.challenge_nonce) {
    return jsonErr(c, "VALIDATION", "No active challenge", 400);
  }
  if (
    domain.challenge_expires_at &&
    new Date(domain.challenge_expires_at).getTime() < Date.now()
  ) {
    return jsonErr(c, "EXPIRED", "Ownership challenge expired", 410, {
      nextAction: "Request a new domain claim",
    });
  }
  const checkUrl = `https://${domain.hostname}/.well-known/oclaunch-verification`;
  const decided = await assessOutboundUrl(checkUrl, { allowLoopback: false });
  if (!decided.ok) {
    return jsonErr(c, "OWNERSHIP_UNVERIFIED", "Ownership could not be verified.", 400);
  }
  const again = await assessOutboundUrl(checkUrl, { allowLoopback: false });
  if (!again.ok) {
    return jsonErr(c, "OWNERSHIP_UNVERIFIED", "Ownership could not be verified.", 400);
  }
  try {
    const res = await fetch(again.url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "OCLaunch-DomainVerify/1.0" },
    });
    const body = (await res.text()).slice(0, 512).trim();
    const matches = await timingSafeEqual(body, domain.challenge_nonce);
    if (res.status !== 200 || !matches) {
      return jsonErr(c, "OWNERSHIP_UNVERIFIED", "Ownership could not be verified.", 400, {
        nextAction: "Serve the nonce over HTTPS on the claimed hostname",
      });
    }
  } catch {
    return jsonErr(c, "OWNERSHIP_UNVERIFIED", "Ownership could not be verified.", 400, {
      retryable: true,
      nextAction: "Serve the nonce over HTTPS on the claimed hostname",
    });
  }
  await c.env.DB.prepare(
    `UPDATE domains SET state = 'compatibility_pending', verified_at = ?, version = version + 1
     WHERE project_id = ? AND id = ?`,
  )
    .bind(nowIso(), projectId, domainId)
    .run();

  if (c.env.ENABLE_PROJECT_DOMAINS !== "true") {
    return jsonOk(c, {
      verified: true,
      state: "compatibility_pending",
      activation: {
        status: "integration_not_configured",
        message:
          "Ownership verified. Gateway DNS provisioning is disabled until ENABLE_PROJECT_DOMAINS and owner-approved deploy.",
      },
    });
  }
  return jsonOk(c, {
    verified: true,
    state: "compatibility_pending",
    activation: {
      status: "integration_not_configured",
      message:
        "ENABLE_PROJECT_DOMAINS is true but gateway Worker / DNS controller bindings are not provisioned in this environment.",
    },
  });
});
