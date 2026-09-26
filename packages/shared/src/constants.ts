export const RULESET_VERSION = "1.0.0";

export const RESERVED_SLUGS = [
  "launch",
  "launch-staging",
  "www",
  "api",
  "admin",
  "mail",
  "support",
  "app",
  "discover",
  "static",
  "assets",
  "preview",
  "oclaunch",
  "orangecloud",
] as const;

export const FINDING_STATES = [
  "observed",
  "triaged",
  "accepted",
  "change_proposed",
  "implemented",
  "verification_pending",
  "verified",
  "dismissed",
  "needs_evidence",
  "reopened",
] as const;

export const FINDING_CATEGORIES = [
  "Clarity",
  "Visual consistency",
  "First-use experience",
  "Accessibility",
  "Release presentation",
  "Access",
  "Regression",
] as const;

/** Ready missions that catch the failure modes vibe-coded apps hit in production. */
export const DANGEROUS_PATH_MISSIONS = [
  {
    title: "Primary task in a private window",
    instructions:
      "Open the release URL in a private/incognito window as a new user. Complete the primary task without help. Note where you get stuck.",
    topicTags: ["first-use", "private-window"],
  },
  {
    title: "Protected page while logged out",
    instructions:
      "Stay logged out. Try to open a page that should require sign-in. Record whether you see protected data, a useful empty state, or a broken redirect.",
    topicTags: ["access", "logged-out"],
  },
  {
    title: "Another account’s data",
    instructions:
      "If you can create two accounts (or use two browsers), sign in as user A, note an item id, then as user B try to open or edit A’s item by URL. Report any data you should not see.",
    topicTags: ["access", "tenancy"],
  },
  {
    title: "Primary task at phone width",
    instructions:
      "Resize to about 390px wide (or use a phone). Complete the same primary task. Note anything below the fold, clipped, or untappable.",
    topicTags: ["mobile", "first-use"],
  },
  {
    title: "Empty state and failed save",
    instructions:
      "Trigger an empty list/state and a failed save (invalid input or offline if possible). Confirm errors are visible and nothing looks silently successful.",
    topicTags: ["errors", "empty-state"],
  },
] as const;

export const RELEASE_ENVIRONMENTS = ["localhost", "preview", "production"] as const;

export const DEFAULT_QUOTAS = {
  projectsPerAccount: 3,
  automatedReviewsPerProjectPerMonth: 2,
  routesPerAutomatedReview: 3,
  viewportsPerAutomatedReview: 2,
  activePatchBuildsPerWorkspace: 1,
  globalBrowserSessions: 2,
  globalSandboxBuilds: 2,
  buildTimeoutMinutes: 10,
  previewTtlHours: 48,
} as const;

export const PRODUCT = {
  name: "OCLaunch",
  tagline: "Build. Review. Improve.",
  headline: "Your next release, better together.",
  support:
    "Get useful feedback on your app, preview improvements, and keep a clear record of what gets better.",
  primaryCta: "Add your project",
  secondaryCta: "Review a project",
  positioning:
    "OCLaunch helps solo founders turn product feedback into reviewed improvements and better releases.",
  domain: "launch.orangecloud.vn",
  parent: "Orangecloud",
} as const;
