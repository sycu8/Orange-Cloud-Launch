import { describe, expect, it } from "vitest";
import { devLoginPermitted, RECOVERY_CODE_BYTES } from "../src/auth/passkeys.js";
import { allowedOrigins, isAllowedOrigin } from "../src/auth/session.js";
import { assessOutboundUrl, hostClass } from "../src/lib/fetch-guard.js";
import { hmacSha256Hex, timingSafeEqual } from "../src/lib/secret.js";
import { detectUpload } from "../src/lib/uploads.js";
import { runDeterministicChecks } from "../src/integrations/deterministic.js";
import { isBlockedUpstream } from "../src/integrations/domains.js";
import { redactReportSummary } from "../src/routes/reports.js";
import { escapeHtml, renderPassportHtml } from "../src/public-html/render.js";
import { randomToken } from "../src/lib/ids.js";

describe("auth origin allowlist", () => {
  const staging = {
    APP_ORIGIN: "https://oclaunch-platform-staging.sycu-lee.workers.dev",
    APP_ENV: "staging",
  };
  const local = {
    APP_ORIGIN: "http://localhost:8787",
    APP_ENV: "development",
  };

  it("allows the configured APP_ORIGIN", () => {
    expect(allowedOrigins(staging)).toEqual([staging.APP_ORIGIN]);
    expect(
      isAllowedOrigin(staging, staging.APP_ORIGIN, `${staging.APP_ORIGIN}/api/auth/passkey/register/options`),
    ).toBe(true);
  });

  it("allows Vite and wrangler localhost origins in development", () => {
    expect(allowedOrigins(local)).toEqual(
      expect.arrayContaining([
        "http://localhost:8787",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8787",
      ]),
    );
    expect(
      isAllowedOrigin(local, "http://localhost:5173", "http://localhost:8787/api/auth/passkey/register/options"),
    ).toBe(true);
  });

  it("allows the Worker request origin even when APP_ORIGIN differs", () => {
    const preview = "https://abcd1234-oclaunch-platform-staging.sycu-lee.workers.dev";
    expect(
      isAllowedOrigin(staging, preview, `${preview}/api/auth/passkey/register/options`),
    ).toBe(true);
  });

  it("rejects unrelated origins", () => {
    expect(
      isAllowedOrigin(staging, "https://evil.example", `${staging.APP_ORIGIN}/api/x`),
    ).toBe(false);
    expect(
      isAllowedOrigin(local, "https://evil.example", "http://localhost:8787/api/x"),
    ).toBe(false);
  });
});

describe("outbound URL guard", () => {
  it("blocks private, loopback, and metadata hosts", () => {
    expect(hostClass("10.0.0.5")).toBe("private");
    expect(hostClass("192.168.1.10")).toBe("private");
    expect(hostClass("172.16.0.1")).toBe("private");
    expect(hostClass("169.254.169.254")).toBe("private");
    expect(hostClass("127.0.0.1")).toBe("loopback");
    expect(hostClass("2130706433")).toBe("loopback");
    expect(hostClass("::1")).toBe("loopback");
    expect(hostClass("[::1]")).toBe("loopback");
    expect(hostClass("fd00::1")).toBe("private");
    expect(hostClass("metadata.google.internal")).toBe("metadata");
    expect(hostClass("8.8.8.8")).toBe("public-ip");
  });

  it("does not fetch a name that resolves to a private address", async () => {
    const findings = await runDeterministicChecks("https://example.com/release", {
      resolve: async () => ["10.1.2.3"],
    });
    expect(findings.some((finding) => finding.title.includes("blocked"))).toBe(true);
    expect(JSON.stringify(findings)).not.toContain("10.1.2.3");
    expect(JSON.stringify(findings)).not.toContain("example.com");
  });

  it("rejects credentials without echoing them", async () => {
    const findings = await runDeterministicChecks("https://user:s3cret@example.com/a");
    expect(findings[0]?.title).toMatch(/credentials/i);
    expect(JSON.stringify(findings)).not.toContain("s3cret");
  });

  it("allows loopback only when asked", async () => {
    const blocked = await assessOutboundUrl("http://127.0.0.1/", { allowLoopback: false });
    const allowed = await assessOutboundUrl("http://127.0.0.1/", { allowLoopback: true });
    expect(blocked.ok).toBe(false);
    expect(allowed.ok).toBe(true);
  });
});

describe("domain upstream guard", () => {
  it("rejects non-https and private hosts", () => {
    expect(isBlockedUpstream("http://localhost/").ok).toBe(false);
    expect(isBlockedUpstream("https://10.0.0.1/").ok).toBe(false);
    expect(isBlockedUpstream("https://127.0.0.1/").ok).toBe(false);
    expect(isBlockedUpstream("https://example.com/app").ok).toBe(true);
  });
});

describe("dev login policy", () => {
  it("requires development, loopback, and a configured secret", () => {
    const ok = {
      appEnv: "development",
      requestHostname: "localhost",
      hostHeader: "localhost:8787",
      secretConfigured: true,
    };
    expect(devLoginPermitted(ok)).toBe(true);
    expect(devLoginPermitted({ ...ok, appEnv: "production" })).toBe(false);
    expect(devLoginPermitted({ ...ok, appEnv: "staging" })).toBe(false);
    expect(devLoginPermitted({ ...ok, requestHostname: "launch.example" })).toBe(false);
    expect(devLoginPermitted({ ...ok, secretConfigured: false })).toBe(false);
  });
});

describe("recovery code material", () => {
  it("issues 128 bits and peppers the hash", async () => {
    const code = randomToken(RECOVERY_CODE_BYTES);
    expect(code).toHaveLength(32);
    const a = await hmacSha256Hex("pepper-a", code);
    const b = await hmacSha256Hex("pepper-b", code);
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("redacted shares", () => {
  it("keeps an allowlist and drops the release URL", () => {
    const share = redactReportSummary({
      label: "v1",
      captured_at: "2026-09-26T00:00:00.000Z",
      source_url: "https://user:secret@example.com/app",
      commit_sha: "abc",
      human_reviews: { sample_size: 1 },
      findings: [{ title: "Title", category: "Clarity", severity: "low", state: "observed", provenance: "human_observation", body: "private" }],
      next_three_actions: ["Triage the open finding"],
    });
    expect(share).toEqual({
      label: "v1",
      captured_at: "2026-09-26T00:00:00.000Z",
      findings: [
        {
          title: "Title",
          category: "Clarity",
          severity: "low",
          state: "observed",
          provenance: "human_observation",
        },
      ],
      next_three_actions: ["Triage the open finding"],
      note: "Redacted share — personal evidence and screenshots omitted by default.",
    });
    expect(JSON.stringify(share)).not.toContain("source_url");
    expect(JSON.stringify(share)).not.toContain("secret");
  });
});

describe("public passport HTML", () => {
  it("omits non-https links and encodes apostrophes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
    const html = renderPassportHtml({
      project: {
        name: "Planner",
        purpose: "Plan",
        audience: "People",
        slug: "planner",
        live_url: "javascript:void(0)",
      },
      releases: [],
      brandVersion: null,
      origin: "https://launch.example",
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a href=\"javascript:");
    const safe = renderPassportHtml({
      project: {
        name: "Planner",
        purpose: "Plan",
        audience: "People",
        slug: "planner",
        live_url: "https://example.com/app",
      },
      releases: [],
      brandVersion: null,
      origin: "https://launch.example",
    });
    expect(safe).toContain("https://example.com/app");
  });
});

describe("upload sniffing", () => {
  it("trusts magic bytes and rejects markup", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectUpload(png, "image")).toEqual({ mime: "image/png" });
    const markup = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    expect("error" in detectUpload(markup, "member")).toBe(true);
  });
});

describe("secret compare", () => {
  it("matches equal strings only", async () => {
    expect(await timingSafeEqual("abc", "abc")).toBe(true);
    expect(await timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
