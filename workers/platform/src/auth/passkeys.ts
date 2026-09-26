import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";
import { newId, randomToken } from "../lib/ids.js";
import { nowIso } from "../lib/http.js";
import { createSession } from "./session.js";

function rp(c: Context<AppEnv>) {
  return {
    rpID: c.env.WEBAUTHN_RP_ID,
    rpName: "OCLaunch",
    origin: c.env.APP_ORIGIN,
  };
}

async function storeChallenge(
  c: Context<AppEnv>,
  kind: "registration" | "authentication",
  challenge: string,
  userId?: string,
): Promise<string> {
  const id = newId("chal");
  const expires = new Date(Date.now() + 5 * 60_000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO auth_challenges (id, challenge, kind, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, challenge, kind, userId ?? null, expires, nowIso())
    .run();
  return id;
}

async function consumeChallenge(
  c: Context<AppEnv>,
  challengeId: string,
  kind: "registration" | "authentication",
): Promise<{ challenge: string; userId: string | null } | null> {
  const row = await c.env.DB.prepare(
    `SELECT challenge, user_id, expires_at, consumed_at, kind FROM auth_challenges WHERE id = ?`,
  )
    .bind(challengeId)
    .first<{
      challenge: string;
      user_id: string | null;
      expires_at: string;
      consumed_at: string | null;
      kind: string;
    }>();
  if (!row || row.kind !== kind || row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const updated = await c.env.DB.prepare(
    `UPDATE auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
  )
    .bind(nowIso(), challengeId)
    .run();
  if (!updated.meta.changes) return null;
  return { challenge: row.challenge, userId: row.user_id };
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
  // Insert user before challenge — auth_challenges.user_id FKs to users(id).
  await c.env.DB.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  )
    .bind(userId, displayName, nowIso())
    .run();
  const challengeId = await storeChallenge(c, "registration", options.challenge, userId);
  return { options, challengeId, userId };
}

export async function verifyRegistration(
  c: Context<AppEnv>,
  body: { challengeId: string; response: unknown },
) {
  const { origin, rpID } = rp(c);
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
    return { ok: false as const, error: "verification_failed" };
  }

  const info = verification.registrationInfo;
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
    const code = randomToken(4);
    plainCodes.push(code);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(code),
    );
    const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
    await c.env.DB.prepare(
      `INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(newId("rcv"), chal.userId, hex, nowIso())
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

/** Labeled local-only login for development without a hardware authenticator. */
export async function devLogin(c: Context<AppEnv>, displayName: string) {
  if (c.env.DEV_AUTH_BYPASS !== "true" || c.env.APP_ENV === "production") {
    return { ok: false as const, error: "dev_auth_disabled" };
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM users WHERE display_name = ? ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(displayName)
    .first<{ id: string }>();
  let userId = existing?.id;
  if (!userId) {
    userId = newId("user");
    await c.env.DB.prepare(
      `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
    )
      .bind(userId, displayName, nowIso())
      .run();
  }
  const session = await createSession(c, userId);
  return { ok: true as const, userId, csrfToken: session.csrfToken, displayName };
}
