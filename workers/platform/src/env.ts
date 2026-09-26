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
 *
 * When Browser Run is provisioned, set ENABLE_BROWSER_RUN=true and add:
 *   [browser]
 *   binding = "BROWSER"
 */
import type { BrowserRunBinding } from "./integrations/browser.js";

export type Env = {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  ASSETS?: Fetcher;
  /** Cloudflare Browser Run binding — human-tester viewport snapshots. */
  BROWSER?: BrowserRunBinding;
  APP_ENV: string;
  APP_ORIGIN: string;
  WEBAUTHN_RP_ID: string;
  DEV_LOGIN_SECRET?: string;
  MAINTENANCE_SECRET?: string;
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
