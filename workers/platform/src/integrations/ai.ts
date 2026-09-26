import type { CheckFinding } from "./deterministic.js";

export type SuggestionFinding = {
  provenance: "model_suggestion";
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  confidence: "low" | "medium" | "high";
  title: string;
  body: string;
  acceptanceCriterion?: string;
};

/** Workers AI adapter — never invents a successful model run without a binding. */
export async function suggestFindings(
  env: { ENABLE_WORKERS_AI: string },
  input: { sourceUrl: string; deterministic: CheckFinding[] },
): Promise<SuggestionFinding[]> {
  if (env.ENABLE_WORKERS_AI !== "true") {
    // Honest offline heuristic labeled as model_suggestion is NOT used.
    // Return empty when AI is not configured — do not fake model output.
    void input;
    return [];
  }
  // Binding not present in MVP Env — keep contract explicit.
  return [];
}
