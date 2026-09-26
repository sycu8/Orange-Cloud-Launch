import { sha256Hex } from "../lib/ids.js";

export function githubConfigured(env: {
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
}): boolean {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_WEBHOOK_SECRET);
}

export async function verifyGitHubSignature(
  secret: string,
  rawBody: ArrayBuffer,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, rawBody);
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `sha256=${hex}`;
  if (expected.length !== signatureHeader.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return ok === 0;
}

export async function deliveryDedupeKey(deliveryId: string): Promise<string> {
  return sha256Hex(`github:delivery:${deliveryId}`);
}
