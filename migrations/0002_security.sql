-- Security follow-ups: rate limits, passkey display name held until verification,
-- and domain rows verified by the old upstream fetch are unverified again.

ALTER TABLE auth_challenges ADD COLUMN pending_display_name TEXT;
ALTER TABLE auth_challenges ADD COLUMN pending_user_id TEXT;

CREATE TABLE request_rates (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  window_start TEXT NOT NULL
);

UPDATE domains
SET verified_at = NULL,
    state = 'ownership_pending'
WHERE verified_at IS NOT NULL
   OR state = 'compatibility_pending';
