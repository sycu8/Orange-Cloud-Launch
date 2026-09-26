import { describe, expect, it } from "vitest";
import { isIndexableHost, robotsTxt, sitemapXml } from "../src/lib/seo.js";

describe("public SEO routes", () => {
  it("indexes only the production hostname", () => {
    expect(isIndexableHost("launch.orangecloud.vn")).toBe(true);
    expect(isIndexableHost("launch-staging.orangecloud.vn")).toBe(false);
    expect(isIndexableHost("localhost")).toBe(false);
  });

  it("blocks crawlers on staging and allows the public site", () => {
    expect(robotsTxt("launch-staging.orangecloud.vn")).toContain("Disallow: /");
    expect(robotsTxt("launch-staging.orangecloud.vn")).not.toContain("Sitemap:");
    const production = robotsTxt("launch.orangecloud.vn");
    expect(production).toContain("Allow: /");
    expect(production).toContain("Disallow: /app/");
    expect(production).toContain("Sitemap: https://launch.orangecloud.vn/sitemap.xml");
  });

  it("lists the homepage in both languages", () => {
    const xml = sitemapXml();
    expect(xml).toContain("https://launch.orangecloud.vn/");
    expect(xml).toContain("https://launch.orangecloud.vn/?lang=vi");
    expect(xml).toContain('hreflang="vi"');
    expect(xml).toContain("https://launch.orangecloud.vn/discover");
  });
});
