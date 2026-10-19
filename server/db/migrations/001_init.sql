-- ============================================================
--  Work Study Automation — initial schema (PostgreSQL 16)
--  Production-grade: UUID keys, FKs, indexes, timestamps.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fast ILIKE / fuzzy search

-- ---------- reference: machines ----------
CREATE TABLE IF NOT EXISTS machines (
  code        text PRIMARY KEY,
  name        text NOT NULL
);

-- ---------- master OB library (the garment operation database) ----------
CREATE TABLE IF NOT EXISTS ob_library (
  id            bigserial PRIMARY KEY,
  category      text NOT NULL,          -- MENS / KIDS / BOYS / WOMENS / OVERSIZE
  product_type  text NOT NULL,          -- CARGO LONG / LONG PANT / SHIRT / ...
  fabric_type   text,                   -- TWILL / DENIM / NYLON / ...
  section       text,                   -- FRONT POCKET / BACK PART / OUTPUT / ...
  process_name  text NOT NULL,
  machine_type  text,                   -- references machines.code (soft ref; data may predate machine list)
  smv           numeric(6,3)
);

CREATE INDEX IF NOT EXISTS ix_ob_category     ON ob_library (category);
CREATE INDEX IF NOT EXISTS ix_ob_product      ON ob_library (product_type);
CREATE INDEX IF NOT EXISTS ix_ob_fabric       ON ob_library (fabric_type);
CREATE INDEX IF NOT EXISTS ix_ob_section      ON ob_library (section);
CREATE INDEX IF NOT EXISTS ix_ob_machine      ON ob_library (machine_type);
CREATE INDEX IF NOT EXISTS ix_ob_cat_prod_fab ON ob_library (category, product_type, fabric_type);
CREATE INDEX IF NOT EXISTS ix_ob_process_trgm ON ob_library USING gin (process_name gin_trgm_ops);

-- ---------- factories / floors / lines ----------
CREATE TABLE IF NOT EXISTS factories (
  code  text PRIMARY KEY,
  name  text NOT NULL
);
CREATE TABLE IF NOT EXISTS lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_code  text NOT NULL REFERENCES factories(code) ON DELETE CASCADE,
  floor         text NOT NULL,
  line_no       int  NOT NULL,
  shape         text NOT NULL CHECK (shape IN ('U','I')),
  UNIQUE (factory_code, line_no)
);

-- ---------- users (app auth) ----------
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username       text UNIQUE NOT NULL,
  name           text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL,          -- WSE / ASST_MGR_CENTRAL / SR_MGR / ADMIN
  factory_code   text REFERENCES factories(code),
  cross_factory  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- operators (uploaded per factory) ----------
CREATE TABLE IF NOT EXISTS operators (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_code  text NOT NULL REFERENCES factories(code) ON DELETE CASCADE,
  op_code       text,
  name          text NOT NULL,
  grade         text,
  floor         text,
  line_no       int,
  machine       text
);
CREATE INDEX IF NOT EXISTS ix_operators_factory ON operators (factory_code);

-- ---------- styles & their derived data ----------
CREATE TABLE IF NOT EXISTS styles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_code    text NOT NULL REFERENCES factories(code),
  style_no        text NOT NULL,
  item            text NOT NULL,
  buyer           text,
  category        text,
  product_type    text,
  fabric_type     text,
  order_qty       int,
  manpower        int,
  step            int NOT NULL DEFAULT 1,
  status          text,
  sample_approved boolean NOT NULL DEFAULT false,
  ob_approved     boolean NOT NULL DEFAULT false,
  ob_version      int NOT NULL DEFAULT 1,
  layout_verified boolean NOT NULL DEFAULT false,
  prepared_by     text,
  approved_by     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_styles_factory ON styles (factory_code);

-- operations placed in a style's OB (copied from the library, editable)
CREATE TABLE IF NOT EXISTS style_operations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id       uuid NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  sl             int  NOT NULL,
  process_name   text NOT NULL,
  machine_type   text,
  smv            numeric(6,3),
  aml            numeric(6,2) DEFAULT 1,
  section        text,
  needle_type    text, needle_size text, thread_needle text, thread_bobbin text,
  gauge text, foot text, pressure text, folder text,
  from_library   boolean NOT NULL DEFAULT true,
  line_no        int,                    -- which physical line this op runs on
  UNIQUE (style_id, sl)
);
CREATE INDEX IF NOT EXISTS ix_style_ops_style ON style_operations (style_id);

-- which lines a style is assigned to
CREATE TABLE IF NOT EXISTS style_lines (
  style_id  uuid NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  factory_code text NOT NULL,
  floor     text NOT NULL,
  line_no   int  NOT NULL,
  shape     text,
  PRIMARY KEY (style_id, line_no)
);

-- auditing
CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  actor      text,
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  at         timestamptz NOT NULL DEFAULT now()
);
