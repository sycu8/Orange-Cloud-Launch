import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";
import { isLoopbackHostname } from "@oclaunch/shared";
import { newId, randomToken } from "../lib/ids.js";
import { nowIso } from "../lib/http.js";
import { hmacSha256Hex, timingSafeEqual } from "../lib/secret.js";
import { createSession, resolveCeremonyOrigin, revokeAllSessions } from "./session.js";

export const LOCAL_DEV_USER_ID = "user_local_founder";
export const RECOVERY_CODE_BYTES = 16;
const DISPLAY_NAME_MAX = 80;

function rp(c: Context<AppEnv>) {
  // expectedOrigin must match clientDataJSON.origin (e.g. Vite :5173 vs wrangler :8787).
  // RP ID must be the ceremony hostname or a registrable suffix of it.
  const origin = resolveCeremonyOrigin(c);
  const hostname = new URL(origin).hostname;
  const configured = c.env.WEBAUTHN_RP_ID;
  const rpID =
    hostname === configured || hostname.endsWith(`.${configured}`)
      ? configured
      : hostname;
  return {
    rpID,
    rpName: "OCLaunch",
    origin,
  };
}

async function storeChallenge(
  c: Context<AppEnv>,
  kind: "registration" | "authentication",
  challenge: string,
  opts?: { userId?: string; pendingUserId?: string; displayName?: string },
): Promise<string> {
  const id = newId("chal");
  const expires = new Date(Date.now() + 5 * 60_000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO auth_challenges (
      id, challenge, kind, user_id, expires_at, created_at, pending_display_name, pending_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      challenge,
      kind,
      opts?.userId ?? null,
      expires,
      nowIso(),
      opts?.displayName ?? null,
      opts?.pendingUserId ?? null,
    )
    .run();
  return id;
}

async function consumeChallenge(
  c: Context<AppEnv>,
  challengeId: string,
  kind: "registration" | "authentication",
): Promise<{ challenge: string; userId: string | null; displayName: string | null } | null> {
  const row = await c.env.DB.prepare(
    `SELECT challenge, user_id, expires_at, consumed_at, kind, pending_display_name, pending_user_id
     FROM auth_challenges WHERE id = ?`,
  )
    .bind(challengeId)
    .first<{
      challenge: string;
      user_id: string | null;
      expires_at: string;
      consumed_at: string | null;
      kind: string;
      pending_display_name: string | null;
      pending_user_id: string | null;
    }>();
  if (!row || row.kind !== kind || row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const updated = await c.env.DB.prepare(
    `UPDATE auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
  )
    .bind(nowIso(), challengeId)
    .run();
  if (!updated.meta.changes) return null;
  return {
    challenge: row.challenge,
    userId: row.user_id ?? row.pending_user_id,
    displayName: row.pending_display_name,
  };
}

export async function registrationOptions(
  c: Context<AppEnv>,
  displayName: string,
) {
  const { rpID, rpName } = rp(c);
  const userId = newId("user");
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: displayName,
    userDisplayName: displayName,
    userID: Uint8Array.from(new TextEncoder().encode(userId)),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
  // user_id FKs to users(id). Hold the new id in pending_user_id until verification succeeds.
  const challengeId = await storeChallenge(c, "registration", options.challenge, {
    pendingUserId: userId,
    displayName: displayName.slice(0, DISPLAY_NAME_MAX),
  });
  return { options, challengeId };
}

export async function verifyRegistration(
  c: Context<AppEnv>,
  body: { challengeId: string; response: unknown },
) {
  const { origin, rpID } = rp(c);
  const pepper = c.env.SESSION_SECRET;
  if (!pepper) return { ok: false as const, error: "recovery_not_configured" };
  const chal = await consumeChallenge(c, body.challengeId, "registration");
  if (!chal?.userId) return { ok: false as const, error: "challenge_invalid" };

  const verification = await verifyRegistrationResponse({
    response: body.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge: chal.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    await c.env.DB.prepare(`DELETE FROM auth_challenges WHERE id = ?`)
      .bind(body.challengeId)
      .run();
    return { ok: false as const, error: "verification_failed" };
  }

  const info = verification.registrationInfo;
  const displayName = (chal.displayName || "Founder").slice(0, DISPLAY_NAME_MAX);
  await c.env.DB.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  )
    .bind(chal.userId, displayName, nowIso())
    .run();
  const credId = newId("cred");
  await c.env.DB.prepare(
    `INSERT INTO credentials (id, user_id, credential_id, public_key, counter, transports, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      credId,
      chal.userId,
      BufferLikeToBase64(info.credential.id),
      publicKeyToBytes(info.credential.publicKey),
      info.credential.counter,
      JSON.stringify(info.credential.transports ?? []),
      nowIso(),
    )
    .run();

  // Generate recovery codes (hashed)
  const plainCodes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = randomToken(RECOVERY_CODE_BYTES);
    plainCodes.push(code);
    const hash = await hmacSha256Hex(pepper, code);
    await c.env.DB.prepare(
      `INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(newId("rcv"), chal.userId, hash, nowIso())
      .run();
  }

  const session = await createSession(c, chal.userId);
  return {
    ok: true as const,
    userId: chal.userId,
    csrfToken: session.csrfToken,
    recoveryCodes: plainCodes,
  };
}

export async function authenticationOptions(c: Context<AppEnv>) {
  const { rpID } = rp(c);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });
  const challengeId = await storeChallenge(c, "authentication", options.challenge);
  return { options, challengeId };
}

export async function verifyAuthentication(
  c: Context<AppEnv>,
  body: { challengeId: string; response: unknown },
) {
  const { origin, rpID } = rp(c);
  const chal = await consumeChallenge(c, body.challengeId, "authentication");
  if (!chal) return { ok: false as const, error: "challenge_invalid" };

  const credIdRaw = (body.response as { id?: string })?.id;
  if (!credIdRaw) return { ok: false as const, error: "missing_credential" };

  const cred = await c.env.DB.prepare(
    `SELECT id, user_id, credential_id, public_key, counter FROM credentials WHERE credential_id = ?`,
  )
    .bind(credIdRaw)
    .first<{
      id: string;
      user_id: string;
      credential_id: string;
      public_key: ArrayBuffer;
      counter: number;
    }>();
  if (!cred) return { ok: false as const, error: "unknown_credential" };

  const verification = await verifyAuthenticationResponse({
    response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge: chal.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(cred.public_key),
      counter: cred.counter,
    },
  });
  if (!verification.verified) {
    return { ok: false as const, error: "verification_failed" };
  }

  await c.env.DB.prepare(`UPDATE credentials SET counter = ? WHERE id = ?`)
    .bind(verification.authenticationInfo.newCounter, cred.id)
    .run();

  const session = await createSession(c, cred.user_id);
  return { ok: true as const, userId: cred.user_id, csrfToken: session.csrfToken };
}

function BufferLikeToBase64(id: Uint8Array | string): string {
  if (typeof id === "string") return id;
  let binary = "";
  for (const b of id) binary += String.fromCharCode(b);
  // Workers provide btoa; encode as base64url for WebAuthn credential ids.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function publicKeyToBytes(key: Uint8Array): ArrayBuffer {
  return key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
}

export function devLoginPermitted(input: {
  appEnv: string;
  requestHostname: string;
  hostHeader: string;
  secretConfigured: boolean;
}): boolean {
  if (input.appEnv === "production" || input.appEnv !== "development") return false;
  if (!input.secretConfigured) return false;
  if (!isLoopbackHostname(input.requestHostname)) return false;
  return isLoopbackHostname(hostnameFromHostHeader(input.hostHeader));
}

function hostnameFromHostHeader(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end > 1 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(":")[0] ?? trimmed;
}

/** Local-only login. Never selects an account by display name. */
export async function devLogin(c: Context<AppEnv>, secret: string) {
  const requestHostname = new URL(c.req.url).hostname;
  const hostHeader = c.req.header("Host") ?? "";
  const configured = Boolean(c.env.DEV_LOGIN_SECRET);
  if (
    !devLoginPermitted({
      appEnv: c.env.APP_ENV,
      requestHostname,
      hostHeader,
      secretConfigured: configured,
    })
  ) {
    return { ok: false as const, error: "dev_auth_disabled" };
  }
  const matches = await timingSafeEqual(secret, c.env.DEV_LOGIN_SECRET ?? "");
  if (!matches) return { ok: false as const, error: "dev_auth_disabled" };

  const displayName = "Local Founder";
  await c.env.DB.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
    .bind(LOCAL_DEV_USER_ID, displayName, nowIso())
    .run();
  await revokeAllSessions(c, LOCAL_DEV_USER_ID);
  const session = await createSession(c, LOCAL_DEV_USER_ID);
  return { ok: true as const, userId: LOCAL_DEV_USER_ID, csrfToken: session.csrfToken, displayName };
}
