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
  const projectId = c.req.param("projectId");
  const domainId = c.req.param("domainId");
  const role = await requireMember(c, projectId, ["owner"]);
  if (!role) return jsonErr(c, "FORBIDDEN", "Owner access required", 403);
  const domain = await c.env.DB.prepare(
    `SELECT * FROM domains WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, domainId)
    .first<{
      upstream_url: string;
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
  const checkUrl = new URL("/.well-known/oclaunch-verification", domain.upstream_url);
  try {
    const res = await fetch(checkUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "OCLaunch-DomainVerify/1.0" },
    });
    const body = (await res.text()).trim();
    if (res.status >= 400 || body !== domain.challenge_nonce) {
      return jsonErr(
        c,
        "OWNERSHIP_UNVERIFIED",
        `Upstream did not serve the expected nonce (HTTP ${res.status}).`,
        400,
        {
          nextAction: `Publish the nonce at ${checkUrl.pathname} on the upstream origin`,
        },
      );
    }
  } catch (err) {
    return jsonErr(
      c,
      "OWNERSHIP_UNVERIFIED",
      err instanceof Error ? err.message : "Upstream fetch failed",
      400,
      { retryable: true, nextAction: "Ensure the upstream is publicly reachable" },
    );
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
