-- ============================================================
--  003 — user management fields for the System Admin area
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS lines  text;                       -- e.g. "1-10" (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email  text;
