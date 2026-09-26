import { RESERVED_SLUGS } from "@oclaunch/shared";
import { randomToken, sha256Hex } from "../lib/ids.js";

export function isReservedHostname(hostname: string): boolean {
  const slug = hostname.split(".")[0] ?? "";
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}

export function isBlockedUpstream(upstreamUrl: string): { ok: true } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(upstreamUrl);
  } catch {
    return { ok: false, reason: "Invalid upstream URL" };
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    return { ok: false, reason: "Upstream must be https (or localhost for lab tests)" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Upstream must not include userinfo" };
  }
  if (url.port && url.port !== "443" && url.port !== "80") {
    return { ok: false, reason: "Alternate ports are not supported in MVP gateway" };
  }
  const host = url.hostname.toLowerCase();
  if (host === "launch.orangecloud.vn" || host.endsWith(".launch.orangecloud.vn")) {
    return { ok: false, reason: "Upstream cannot point at the OCLaunch platform" };
  }
  if (host.endsWith(".orangecloud.vn") && host !== "orangecloud.vn") {
    // Prevent alias-to-alias loops for sibling project hosts
    return { ok: false, reason: "Upstream cannot be another orangecloud.vn project alias" };
  }
  return { ok: true };
}

export async function createChallenge(): Promise<{ nonce: string; hash: string; expiresAt: string }> {
  const nonce = randomToken(24);
  const hash = await sha256Hex(nonce);
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  return { nonce, hash, expiresAt };
}
