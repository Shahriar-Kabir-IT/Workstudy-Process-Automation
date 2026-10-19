-- ============================================================
--  002 — app state persistence
--  Styles keep queryable core columns PLUS a `doc` JSONB that holds
--  the full workflow object (operations, assigned lines, change
--  requests, sample photos). Server owns the id and timestamps.
-- ============================================================

ALTER TABLE styles ADD COLUMN IF NOT EXISTS doc jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE styles ADD COLUMN IF NOT EXISTS updated_by text;

CREATE INDEX IF NOT EXISTS ix_styles_status ON styles (status);
CREATE INDEX IF NOT EXISTS ix_styles_updated ON styles (updated_at DESC);

-- keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_styles_updated ON styles;
CREATE TRIGGER trg_styles_updated BEFORE UPDATE ON styles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
