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
  if (c.env.ENABLE_PROJECT_DOMAINS !== "true") {
    return jsonErr(
      c,
      "INTEGRATION_NOT_CONFIGURED",
      "Project-domain gateway is prepared but disabled until DNS inventory and deploy approval.",
      503,
      {
        nextAction:
          "Review docs/deployment.md, inventory orangecloud.vn DNS, then enable ENABLE_PROJECT_DOMAINS after approval",
      },
    );
  }
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
      verification: {
        path: "/.well-known/oclaunch-verification",
        body: challenge.nonce,
        expiresAt: challenge.expiresAt,
      },
      note: "Serve the nonce at the path on the upstream origin before activation. Live DNS changes require owner approval.",
    },
    201,
  );
});
