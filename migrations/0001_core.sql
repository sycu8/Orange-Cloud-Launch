-- OCLaunch D1 migration 0001 — core schema (extended from design-pack reference)
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX credentials_user ON credentials(user_id);

CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('registration','authentication')),
  user_id TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_token ON sessions(token_hash);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL,
  audience TEXT NOT NULL,
  primary_task TEXT NOT NULL DEFAULT '',
  live_url TEXT,
  category TEXT NOT NULL DEFAULT 'productivity',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','unlisted','public')),
  screenshot_artifact_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','maintainer','reviewer')),
  PRIMARY KEY(project_id, user_id)
);

CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  source_url TEXT NOT NULL,
  commit_sha TEXT,
  deployment_id TEXT,
  ruleset_version TEXT NOT NULL DEFAULT '1.0.0',
  captured_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  UNIQUE(project_id, id)
);
CREATE INDEX releases_project_time ON releases(project_id, captured_at DESC);

CREATE TABLE brand_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, version),
  UNIQUE(project_id, id)
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  release_id TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  width INTEGER,
  height INTEGER,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, id),
  FOREIGN KEY(project_id, release_id) REFERENCES releases(project_id, id)
);

CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  review_id TEXT,
  x_norm REAL NOT NULL CHECK(x_norm >= 0 AND x_norm <= 1),
  y_norm REAL NOT NULL CHECK(y_norm >= 0 AND y_norm <= 1),
  note TEXT NOT NULL DEFAULT '',
  viewport_width INTEGER NOT NULL,
  viewport_height INTEGER NOT NULL,
  UNIQUE(project_id, id),
  FOREIGN KEY(project_id, artifact_id) REFERENCES artifacts(project_id, id)
);

CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL,
  topic_tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(topic_tags)),
  language TEXT NOT NULL DEFAULT 'en',
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('draft','open','closed')),
  invite_token_hash TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, id),
  FOREIGN KEY(project_id, release_id) REFERENCES releases(project_id, id)
);
CREATE INDEX missions_project_state ON missions(project_id, state);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  audience_fit TEXT NOT NULL CHECK(audience_fit IN ('target_user','peer','unknown')),
  outcome TEXT NOT NULL CHECK(outcome IN ('completed','with_help','could_not_complete','not_attempted')),
  tried TEXT NOT NULL DEFAULT '',
  expected TEXT NOT NULL DEFAULT '',
  stuck TEXT NOT NULL DEFAULT '',
  observations TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, id),
  FOREIGN KEY(project_id, mission_id) REFERENCES missions(project_id, id)
);

CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  review_id TEXT,
  provenance TEXT NOT NULL CHECK(provenance IN ('human_observation','deterministic_check','model_suggestion')),
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('blocker','high','medium','low')),
  confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  acceptance_criterion TEXT,
  state TEXT NOT NULL DEFAULT 'observed',
  dismiss_rationale TEXT,
  record_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, id),
  FOREIGN KEY(project_id, release_id) REFERENCES releases(project_id, id)
);
CREATE INDEX findings_release_state ON findings(project_id, release_id, state);

CREATE TABLE finding_evidence (
  project_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  PRIMARY KEY(finding_id, artifact_id),
  FOREIGN KEY(project_id, finding_id) REFERENCES findings(project_id, id),
  FOREIGN KEY(project_id, artifact_id) REFERENCES artifacts(project_id, id)
);

CREATE TABLE change_sets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_sha TEXT NOT NULL,
  head_sha TEXT,
  brand_version_id TEXT,
  patch_digest TEXT,
  preview_url TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  state TEXT NOT NULL DEFAULT 'proposed',
  approved_sha TEXT,
  approved_by TEXT REFERENCES users(id),
  export_artifact_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, id),
  FOREIGN KEY(project_id, brand_version_id) REFERENCES brand_versions(project_id, id)
);

CREATE TABLE change_set_findings (
  project_id TEXT NOT NULL,
  change_set_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  PRIMARY KEY(change_set_id, finding_id),
  FOREIGN KEY(project_id, change_set_id) REFERENCES change_sets(project_id, id),
  FOREIGN KEY(project_id, finding_id) REFERENCES findings(project_id, id)
);

CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  checked_sha TEXT,
  criterion TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('pass','fail','inconclusive')),
  evidence_artifact_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL,
  checked_by TEXT REFERENCES users(id),
  FOREIGN KEY(project_id, finding_id) REFERENCES findings(project_id, id),
  FOREIGN KEY(project_id, release_id) REFERENCES releases(project_id, id),
  FOREIGN KEY(project_id, evidence_artifact_id) REFERENCES artifacts(project_id, id)
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  ruleset_version TEXT NOT NULL,
  brand_version_id TEXT,
  artifact_id TEXT,
  summary_json TEXT NOT NULL CHECK(json_valid(summary_json)),
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  UNIQUE(project_id, id),
  UNIQUE(project_id, release_id, version),
  FOREIGN KEY(project_id, release_id) REFERENCES releases(project_id, id),
  FOREIGN KEY(project_id, brand_version_id) REFERENCES brand_versions(project_id, id)
);

CREATE TABLE report_shares (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  redacted_json TEXT NOT NULL CHECK(json_valid(redacted_json)),
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(project_id, report_id) REFERENCES reports(project_id, id)
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  upstream_url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'requested',
  challenge_nonce TEXT,
  challenge_hash TEXT,
  challenge_expires_at TEXT,
  verified_at TEXT,
  cloudflare_resource_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('github')),
  external_id TEXT,
  config_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(config_json)),
  status TEXT NOT NULL DEFAULT 'not_configured',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at TEXT,
  UNIQUE(project_id, provider)
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('review','patch','verify','report','domain','delete','export')),
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  context_json TEXT NOT NULL CHECK(json_valid(context_json)),
  result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, kind, idempotency_key)
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  created_at TEXT NOT NULL,
  sent_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX outbox_unsent ON outbox(created_at) WHERE sent_at IS NULL;

CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  source_key TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE usage_ledger (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  job_id TEXT,
  resource TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity >= 0),
  unit TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE quotas (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  limit_value REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'month',
  PRIMARY KEY(scope, scope_id, resource, period)
);

CREATE TABLE moderation_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
