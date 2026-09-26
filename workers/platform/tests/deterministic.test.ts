import { describe, expect, it } from "vitest";
import { runDeterministicChecks } from "../src/integrations/deterministic.js";
import { isBlockedUpstream, isReservedHostname } from "../src/integrations/domains.js";
import { verifyGitHubSignature } from "../src/integrations/github.js";

describe("deterministic checks", () => {
  it("flags invalid URLs", async () => {
    const findings = await runDeterministicChecks("not-a-url");
    expect(findings[0]?.severity).toBe("blocker");
  });

  it("blocks private hosts without fetch", async () => {
    const findings = await runDeterministicChecks("https://192.168.1.10/");
    expect(findings.some((f) => f.title.includes("blocked"))).toBe(true);
  });
});

describe("domain guards", () => {
  it("reserves platform hostnames", () => {
    expect(isReservedHostname("launch.orangecloud.vn")).toBe(true);
    expect(isReservedHostname("my-app.orangecloud.vn")).toBe(false);
  });

  it("rejects alias loops", () => {
    const r = isBlockedUpstream("https://other.orangecloud.vn");
    expect(r.ok).toBe(false);
  });
});

describe("github signature", () => {
  it("accepts valid HMAC", async () => {
    const body = new TextEncoder().encode('{"ok":true}');
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, body);
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const ok = await verifyGitHubSignature(
      "secret",
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      `sha256=${hex}`,
    );
    expect(ok).toBe(true);
  });
});
