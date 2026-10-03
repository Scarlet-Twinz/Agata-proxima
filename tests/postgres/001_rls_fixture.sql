-- Proxima PostgreSQL isolation verification fixture.
-- This is intentionally independent of the Rust engine: it proves the database
-- enforcement layer itself has the expected fail-closed behavior.

BEGIN;

CREATE SCHEMA IF NOT EXISTS proxima_test;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxima_gateway') THEN
    CREATE ROLE proxima_gateway LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'proxima-gateway-dev-only';
  ELSE
    ALTER ROLE proxima_gateway WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'proxima-gateway-dev-only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxima_tenant_a') THEN
    CREATE ROLE proxima_tenant_a NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxima_tenant_b') THEN
    CREATE ROLE proxima_tenant_b NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT proxima_tenant_a TO proxima_gateway WITH SET TRUE;
GRANT proxima_tenant_b TO proxima_gateway WITH SET TRUE;

DROP TABLE IF EXISTS proxima_test.records;

CREATE TABLE proxima_test.records (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  secret text NOT NULL
);

INSERT INTO proxima_test.records (tenant_id, secret)
VALUES
  ('tenant_a', 'A-secret'),
  ('tenant_b', 'B-secret');

ALTER TABLE proxima_test.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxima_test.records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_a_records ON proxima_test.records
  TO proxima_tenant_a
  USING (tenant_id = 'tenant_a')
  WITH CHECK (tenant_id = 'tenant_a');

CREATE POLICY tenant_b_records ON proxima_test.records
  TO proxima_tenant_b
  USING (tenant_id = 'tenant_b')
  WITH CHECK (tenant_id = 'tenant_b');

GRANT USAGE ON SCHEMA proxima_test TO proxima_tenant_a, proxima_tenant_b;
GRANT SELECT, INSERT, UPDATE, DELETE ON proxima_test.records TO proxima_tenant_a, proxima_tenant_b;
GRANT USAGE, SELECT ON SEQUENCE proxima_test.records_id_seq TO proxima_tenant_a, proxima_tenant_b;

COMMIT;
