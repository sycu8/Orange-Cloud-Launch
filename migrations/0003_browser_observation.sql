-- Expand findings provenance so Browser Run human-tester notes stay distinct
-- from real human_observation outcomes and deterministic fetch checks.
PRAGMA foreign_keys = OFF;

CREATE TABLE findings_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  review_id TEXT,
  provenance TEXT NOT NULL CHECK(provenance IN (
    'human_observation',
    'deterministic_check',
    'model_suggestion',
    'browser_observation'
  )),
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('blocker', 'high', 'medium', 'low')),
  confidence TEXT NOT NULL CHECK(confidence IN ('low', 'medium', 'high')),
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

INSERT INTO findings_new (
  id, project_id, release_id, review_id, provenance, category, severity, confidence,
  title, body, acceptance_criterion, state, dismiss_rationale, record_version,
  created_at, updated_at
)
SELECT
  id, project_id, release_id, review_id, provenance, category, severity, confidence,
  title, body, acceptance_criterion, state, dismiss_rationale, record_version,
  created_at, updated_at
FROM findings;

DROP TABLE findings;
ALTER TABLE findings_new RENAME TO findings;

CREATE INDEX findings_release_state ON findings(project_id, release_id, state);

PRAGMA foreign_keys = ON;
