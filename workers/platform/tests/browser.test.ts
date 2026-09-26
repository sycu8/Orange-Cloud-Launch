import { describe, expect, it, vi } from "vitest";
import {
  discoverFromSnapshot,
  looksLikeBotChallenge,
  runBrowserReview,
  selectHumanTesterRoutes,
} from "../src/integrations/browser.js";

/** Minimal valid PNG (1x1). */
const TINY_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

describe("selectHumanTesterRoutes", () => {
  it("keeps primary route first and caps at quota", () => {
    const routes = selectHumanTesterRoutes(
      "https://app.example.com/home",
      [
        "https://app.example.com/pricing",
        "https://other.example.com/x",
        "https://app.example.com/docs/a/b/c",
        "https://app.example.com/about",
        "mailto:hi@example.com",
      ],
      3,
    );
    expect(routes[0]).toBe("/home");
    expect(routes).toHaveLength(3);
    expect(routes).toContain("/pricing");
    expect(routes).toContain("/about");
    expect(routes).not.toContain("/docs/a/b/c");
  });
});

describe("looksLikeBotChallenge", () => {
  it("detects Cloudflare-style interstitials", () => {
    expect(
      looksLikeBotChallenge({
        pageTitle: "Just a moment...",
        markdown: "Checking your browser before accessing the site.",
      }),
    ).toBe(true);
    expect(
      looksLikeBotChallenge({
        pageTitle: "Welcome",
        markdown: "# Ship your next release",
      }),
    ).toBe(false);
  });
});

describe("discoverFromSnapshot", () => {
  it("reports bot protection without suggesting bypass", () => {
    const findings = discoverFromSnapshot({
      route: "/",
      viewportLabel: "1280x800",
      captureIndex: 0,
      pageTitle: "Just a moment...",
      markdown: "Checking your browser before accessing example.com.",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("Access");
    expect(findings[0]?.body).toMatch(/does not bypass/i);
    expect(findings[0]?.body).toMatch(/allowlist/i);
  });

  it("never uses human_observation provenance", () => {
    const findings = discoverFromSnapshot({
      route: "/",
      viewportLabel: "1280x800",
      captureIndex: 0,
      pageTitle: "",
      markdown: "ok",
      accessibilityTree: { role: "RootWebArea", children: [] },
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.provenance === "browser_observation")).toBe(true);
  });

  it("flags empty first paint without inventing a readiness score", () => {
    const findings = discoverFromSnapshot({
      route: "/",
      viewportLabel: "390x844",
      captureIndex: 1,
      pageTitle: "App",
      markdown: "Hi",
      accessibilityTree: { role: "RootWebArea", name: "App", children: [] },
    });
    expect(findings.some((f) => /Near-empty/i.test(f.title))).toBe(true);
  });
});

describe("runBrowserReview", () => {
  it("stays not-configured when flag is off", async () => {
    const result = await runBrowserReview(
      { ENABLE_BROWSER_RUN: "false" },
      "https://example.com/",
    );
    expect(result.status).toBe("integration_not_configured");
    expect(result.captures).toHaveLength(0);
    expect(result.message).not.toMatch(/screenshot/i);
  });

  it("stays not-configured when binding is missing", async () => {
    const result = await runBrowserReview(
      { ENABLE_BROWSER_RUN: "true" },
      "https://example.com/",
    );
    expect(result.status).toBe("integration_not_configured");
    expect(result.captures).toHaveLength(0);
  });

  it("skips private hosts without claiming captures", async () => {
    const runner = vi.fn();
    const result = await runBrowserReview(
      { ENABLE_BROWSER_RUN: "true" },
      "https://192.168.1.10/",
      { runner },
    );
    expect(result.status).toBe("skipped");
    expect(runner).not.toHaveBeenCalled();
  });

  it("captures viewports and records browser_observation findings only", async () => {
    const runner = vi.fn(async (action: string, options: Record<string, unknown>) => {
      if (action === "links") {
        return {
          links: [
            { url: "https://example.com/pricing" },
            { url: "https://example.com/about" },
            { url: "https://evil.test/x" },
          ],
        };
      }
      if (action === "snapshot") {
        const width = (options.viewport as { width: number }).width;
        return {
          screenshot: toBase64(TINY_PNG),
          markdown:
            width < 500
              ? "# Example\n\nA short mobile page with enough text to read but no buttons."
              : "# Example Domain\n\nThis domain is for use in documentation examples.\n\n[Learn more](/about)",
          accessibilityTree: {
            role: "RootWebArea",
            name: "Example Domain",
            children:
              width < 500
                ? [{ role: "heading", name: "Example", level: 1 }]
                : [
                    { role: "heading", name: "Example Domain", level: 1 },
                    { role: "link", name: "Learn more" },
                    { role: "main", name: "Content", children: [] },
                  ],
          },
          meta: { status: 200, title: "Example Domain" },
        };
      }
      throw new Error(`unexpected action ${action}`);
    });

    const result = await runBrowserReview(
      { ENABLE_BROWSER_RUN: "true" },
      "https://example.com/",
      { runner },
    );

    expect(result.status).toBe("completed");
    expect(result.routesVisited[0]).toBe("/");
    expect(result.routesVisited.length).toBeGreaterThan(1);
    expect(result.viewports).toEqual(["1280x800", "390x844"]);
    expect(result.captures.length).toBeGreaterThanOrEqual(2);
    expect(result.findings.every((f) => f.provenance === "browser_observation")).toBe(true);
    expect(result.message).toMatch(/not human review outcomes/i);
    expect(runner).toHaveBeenCalled();
  });
});
