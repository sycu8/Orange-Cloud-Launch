import { describe, expect, it } from "vitest";
import { createProjectSchema, slugSchema } from "./schemas.js";
import { brandProfileToCss, defaultBrandProfile } from "./brand.js";

describe("slugSchema", () => {
  it("accepts kebab-case", () => {
    expect(slugSchema.parse("weekly-planner")).toBe("weekly-planner");
  });

  it("rejects reserved slugs", () => {
    expect(() => slugSchema.parse("launch")).toThrow(/reserved/i);
  });
});

describe("createProjectSchema", () => {
  it("defaults visibility to private", () => {
    const parsed = createProjectSchema.parse({
      name: "Planner",
      slug: "planner-app",
      purpose: "Help people plan a week",
      audience: "Busy professionals",
    });
    expect(parsed.visibility).toBe("private");
  });
});

describe("brandProfileToCss", () => {
  it("emits CSS variables", () => {
    const css = brandProfileToCss(
      defaultBrandProfile({ purpose: "p", audience: "a" }),
    );
    expect(css).toContain("--brand-action:");
  });
});
