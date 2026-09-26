import { describe, expect, it } from "vitest";
import { cacheControlForKey, contentTypeForKey, publicStaticKey } from "../src/lib/static-files.js";

describe("public static keys", () => {
  it("accepts site files and rejects traversal", () => {
    expect(publicStaticKey("/favicon.svg")).toBe("favicon.svg");
    expect(publicStaticKey("/assets/oclaunch-icon-abc.svg")).toBe("assets/oclaunch-icon-abc.svg");
    expect(publicStaticKey("/index.html")).toBe("index.html");
    expect(publicStaticKey("/")).toBeNull();
    expect(publicStaticKey("/../secrets")).toBeNull();
    expect(publicStaticKey("/%2e%2e/secrets")).toBeNull();
    expect(publicStaticKey("/api/health")).toBeNull();
    expect(publicStaticKey("/p/demo")).toBeNull();
  });

  it("labels the logo as SVG and caches hashed assets", () => {
    expect(contentTypeForKey("assets/oclaunch-icon-abc.svg")).toBe("image/svg+xml");
    expect(contentTypeForKey("assets/index-abc.js")).toContain("javascript");
    expect(cacheControlForKey("assets/oclaunch-icon-abc.svg")).toContain("immutable");
    expect(cacheControlForKey("index.html")).toContain("must-revalidate");
    expect(cacheControlForKey("favicon.svg")).toContain("must-revalidate");
  });
});
