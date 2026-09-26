const CATEGORY_KEYS: Record<string, string> = {
  Clarity: "label.category.clarity",
  "Visual consistency": "label.category.visual",
  "First-use experience": "label.category.firstUse",
  Accessibility: "label.category.a11y",
  "Release presentation": "label.category.presentation",
  Access: "label.category.access",
  Regression: "label.category.regression",
};

export const FINDING_CATEGORY_VALUES = [
  "First-use experience",
  "Clarity",
  "Access",
  "Regression",
  "Visual consistency",
  "Accessibility",
  "Release presentation",
];

const EXACT: Record<string, string> = {
  "Capture the next release after deploying changes": "reports.action.nextVersion",
  "Open a focused Review Mission for first-use": "reports.action.askSomeone",
  "Approve a brand version before the next visual pass": "reports.action.lookAgain",
  "Save the next version after the fix is live.": "reports.action.nextVersion",
  "Ask someone to try the main task.": "reports.action.askSomeone",
  "Look at the page again before the next change.": "reports.action.lookAgain",
  "Cross-browser rendering beyond Chromium Browser Run": "reports.untested.browsers",
  "Authenticated multi-step journeys": "reports.untested.signedIn",
  "Performance budgets": "reports.untested.speed",
  "Browser Run human-tester viewport snapshots were not captured for this release":
    "reports.untested.noAuto",
  "Production live URL was not the human review target for this report": "reports.untested.notLive",
  "Other browsers besides the automatic check.": "reports.untested.browsers",
  "Steps that need someone who is signed in.": "reports.untested.signedIn",
  "How fast the page loads.": "reports.untested.speed",
  "An automatic look at the page was not saved for this version.": "reports.untested.noAuto",
  "People did not try the live site for this record.": "reports.untested.notLive",
};

const PREFIXES: Array<[string, string]> = [
  ["Preview or export an improvement for:", "reports.action.fix"],
  ["Collect more evidence for:", "reports.action.more"],
  ["Triage open finding:", "reports.action.review"],
  ["Hand off a fix for:", "reports.action.fix"],
  ["Add a clearer note for:", "reports.action.more"],
  ["Decide what to do about:", "reports.action.review"],
];

export function categoryLabel(t: (key: string) => string, value: string) {
  const key = CATEGORY_KEYS[value];
  return key ? t(key) : value;
}

export function stateLabel(t: (key: string) => string, state: string) {
  const key = `changes.state.${state}`;
  const text = t(key);
  return text === key ? state.replaceAll("_", " ") : text;
}

export function outcomeLabel(t: (key: string) => string, outcome: string) {
  const map: Record<string, string> = {
    completed: "inbox.out.completed",
    with_help: "inbox.out.withHelp",
    could_not_complete: "inbox.out.couldNot",
    not_attempted: "inbox.out.notAttempted",
  };
  const key = map[outcome];
  return key ? t(key) : outcome.replaceAll("_", " ");
}

/** Turn stored report sentences into the current language. Unknown text stays as written. */
export function plainStoredLine(t: (key: string) => string, text: string) {
  const exact = EXACT[text];
  if (exact) return t(exact);
  for (const [prefix, key] of PREFIXES) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length).trim();
      return rest ? `${t(key)} ${rest}` : t(key);
    }
  }
  return text;
}
