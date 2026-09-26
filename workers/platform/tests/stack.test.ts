import { describe, expect, it } from "vitest";
import { detectStackFromPackageJson } from "../src/integrations/stack.js";

describe("detectStackFromPackageJson", () => {
  it("accepts react+vite+tailwind", () => {
    const r = detectStackFromPackageJson(
      JSON.stringify({
        dependencies: { react: "19" },
        devDependencies: { vite: "7", tailwindcss: "4" },
      }),
    );
    expect(r.supported).toBe(true);
    expect(r.profile).toBe("react-vite-tailwind");
  });

  it("rejects next apps for auto PR profile", () => {
    const r = detectStackFromPackageJson(
      JSON.stringify({
        dependencies: { react: "19", next: "15" },
        devDependencies: { vite: "7", tailwindcss: "4" },
      }),
    );
    expect(r.supported).toBe(false);
    expect(r.recommendation).toBe("agent_export");
  });
});
