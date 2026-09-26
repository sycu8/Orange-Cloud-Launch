import { describe, expect, it } from "vitest";
import { UNCONNECTED_BASE_SHA } from "./constants.js";
import { createChangeSetSchema } from "./schemas.js";
import { buildPlainFixNote, isConnectedRevision } from "./fix-note.js";

describe("createChangeSetSchema base revision", () => {
  it("starts a fix without a commit code", () => {
    expect(createChangeSetSchema.parse({ findingIds: ["f1"] }).baseSha).toBe(
      UNCONNECTED_BASE_SHA,
    );
    expect(
      createChangeSetSchema.parse({ findingIds: ["f1"], baseSha: "   " }).baseSha,
    ).toBe(UNCONNECTED_BASE_SHA);
  });

  it("keeps a real version code and rejects a fragment", () => {
    expect(
      createChangeSetSchema.parse({ findingIds: ["f1"], baseSha: " abc1234 " }).baseSha,
    ).toBe("abc1234");
    expect(() =>
      createChangeSetSchema.parse({ findingIds: ["f1"], baseSha: "abc" }),
    ).toThrow(/7/);
  });
});

describe("buildPlainFixNote", () => {
  it("explains an unconnected fix in plain language", () => {
    const note = buildPlainFixNote({
      projectName: "Weekly planner",
      purpose: "Plan a week",
      findings: [
        {
          title: "Save button is below the fold",
          body: "On a phone, the save button never appears.",
          acceptanceCriterion: "The save button is visible without scrolling.",
        },
      ],
      baseSha: UNCONNECTED_BASE_SHA,
    });
    expect(note).toContain('existing project "Weekly planner"');
    expect(note).toContain("No code version is connected.");
    expect(note).not.toContain(UNCONNECTED_BASE_SHA);
    expect(note).toContain("1. Save button is below the fold");
    expect(note).toContain("Done when: The save button is visible without scrolling.");
    expect(note).toContain("Do not delete, skip, or rewrite tests");
    expect(isConnectedRevision(UNCONNECTED_BASE_SHA)).toBe(false);
    expect(isConnectedRevision("abc1234")).toBe(true);
  });
});
