import { describe, expect, it } from "vitest";
import {
  createOwnerFindingSchema,
  createProjectSchema,
  createReleaseSchema,
  slugSchema,
} from "./schemas.js";
import { brandProfileToCss, defaultBrandProfile } from "./brand.js";
import { DANGEROUS_PATH_MISSIONS, FINDING_CATEGORIES } from "./constants.js";

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

describe("createOwnerFindingSchema", () => {
  it("defaults category and severity for founder notes", () => {
    const parsed = createOwnerFindingSchema.parse({
      title: "CTA hard to find",
      body: "On mobile the button sat below the fold.",
    });
    expect(parsed.category).toBe("First-use experience");
    expect(parsed.severity).toBe("medium");
  });

  it("accepts Access and Regression categories", () => {
    expect(FINDING_CATEGORIES).toContain("Access");
    expect(FINDING_CATEGORIES).toContain("Regression");
    const parsed = createOwnerFindingSchema.parse({
      title: "Saw another user’s plan",
      body: "Opened /plans/xyz while logged in as peer.",
      category: "Access",
    });
    expect(parsed.category).toBe("Access");
  });
});

describe("dangerous path missions", () => {
  it("ships five default missions", () => {
    expect(DANGEROUS_PATH_MISSIONS).toHaveLength(5);
  });
});

describe("createReleaseSchema", () => {
  it("defaults environment to preview", () => {
    const parsed = createReleaseSchema.parse({
      label: "r1",
      sourceUrl: "https://example.com",
    });
    expect(parsed.environment).toBe("preview");
  });
});
