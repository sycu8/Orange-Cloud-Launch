-- Environment line: where a human tried the release (not inferred from success).
ALTER TABLE releases ADD COLUMN environment TEXT NOT NULL DEFAULT 'preview';
ALTER TABLE releases ADD COLUMN reviewed_url TEXT;
