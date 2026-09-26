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
] as const;

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
