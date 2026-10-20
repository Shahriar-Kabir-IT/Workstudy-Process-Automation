-- ============================================================
--  004 — operators can belong to a NAMED line (A, B, New-01, …)
--  line_no (int) can't hold named lines, so add a text line label.
-- ============================================================
ALTER TABLE operators ADD COLUMN IF NOT EXISTS line_label text;
UPDATE operators SET line_label = line_no::text WHERE line_label IS NULL AND line_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_operators_line ON operators (factory_code, line_label);
