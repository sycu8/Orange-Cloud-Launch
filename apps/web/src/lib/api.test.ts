import { describe, expect, it } from "vitest";
import { getCsrfToken, setCsrfToken } from "./api";

describe("csrf token helper", () => {
  it("stores token", () => {
    setCsrfToken("abc");
    expect(getCsrfToken()).toBe("abc");
    setCsrfToken(null);
    expect(getCsrfToken()).toBeNull();
  });
});
