/**
 * Binding inventory (MVP):
 * | Binding    | Service        | Purpose                         | Access        | Failure behavior              |
 * |------------|----------------|---------------------------------|---------------|-------------------------------|
 * | ASSETS     | Static Assets  | SPA shell                       | HTTP reads    | Fall through SPA              |
 * | DB         | D1             | Authoritative records + outbox  | Prepared SQL  | 5xx; no silent fallback       |
 * | ARTIFACTS  | R2             | Screenshots/exports             | Stream I/O    | Structured not-configured/err |
 * | (vars)     | Worker vars    | Feature flags / origins         | Read-only     | Safe defaults                 |
 *
 * Deferred until credentials/provisioning:
 * JOBS queue, REVIEW_FLOW/PATCH_FLOW workflows, BROWSER, AI, ADMISSION DO,
 * GITHUB service binding, BUILDER/Sandbox, project-domain gateway.
 */
export type Env = {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  ASSETS?: Fetcher;
  APP_ENV: string;
  APP_ORIGIN: string;
  WEBAUTHN_RP_ID: string;
  DEV_AUTH_BYPASS: string;
  ENABLE_PATCH_PR: string;
  ENABLE_PROJECT_DOMAINS: string;
  ENABLE_BROWSER_RUN: string;
  ENABLE_WORKERS_AI: string;
  RULESET_VERSION: string;
  SESSION_SECRET?: string;
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  JOBS?: Queue;
};
