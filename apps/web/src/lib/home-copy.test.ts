import { describe, expect, it } from "vitest";
import { homeEn, homeVi } from "./home-copy";

describe("home copy", () => {
  it("translates every English homepage string", () => {
    const enKeys = Object.keys(homeEn).sort();
    const viKeys = Object.keys(homeVi).sort();
    expect(viKeys).toEqual(enKeys);
    for (const key of enKeys) {
      const en = homeEn[key] ?? "";
      const vi = homeVi[key] ?? "";
      expect(en.trim().length).toBeGreaterThan(0);
      expect(vi.trim().length).toBeGreaterThan(0);
      expect(vi).not.toBe(en);
    }
  });
});
