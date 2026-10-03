BEGIN;

CREATE SCHEMA IF NOT EXISTS proxima_external;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxima_tenant_tenant_a') THEN
    CREATE ROLE proxima_tenant_tenant_a LOGIN PASSWORD 'tenant-a-password' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxima_tenant_tenant_b') THEN
    CREATE ROLE proxima_tenant_tenant_b LOGIN PASSWORD 'tenant-b-password' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxima_tenant_tenant_c') THEN
    CREATE ROLE proxima_tenant_tenant_c LOGIN PASSWORD 'tenant-c-password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

ALTER ROLE proxima_tenant_tenant_a LOGIN PASSWORD 'tenant-a-password';
ALTER ROLE proxima_tenant_tenant_b LOGIN PASSWORD 'tenant-b-password';
ALTER ROLE proxima_tenant_tenant_c LOGIN PASSWORD 'tenant-c-password';

DROP TABLE IF EXISTS proxima_external.records;

CREATE TABLE proxima_external.records (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  secret text NOT NULL
);

INSERT INTO proxima_external.records (tenant_id, secret)
VALUES ('tenant_a','A-secret'),('tenant_b','B-secret'),('tenant_c','C-secret');

ALTER TABLE proxima_external.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxima_external.records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_a_policy ON proxima_external.records
  FOR ALL TO proxima_tenant_tenant_a
  USING (tenant_id='tenant_a') WITH CHECK (tenant_id='tenant_a');
CREATE POLICY tenant_b_policy ON proxima_external.records
  FOR ALL TO proxima_tenant_tenant_b
  USING (tenant_id='tenant_b') WITH CHECK (tenant_id='tenant_b');
CREATE POLICY tenant_c_policy ON proxima_external.records
  FOR ALL TO proxima_tenant_tenant_c
  USING (tenant_id='tenant_c') WITH CHECK (tenant_id='tenant_c');

GRANT USAGE ON SCHEMA proxima_external TO proxima_tenant_tenant_a,proxima_tenant_tenant_b,proxima_tenant_tenant_c;
GRANT SELECT,INSERT,UPDATE,DELETE ON proxima_external.records TO proxima_tenant_tenant_a,proxima_tenant_tenant_b,proxima_tenant_tenant_c;
GRANT USAGE,SELECT ON SEQUENCE proxima_external.records_id_seq TO proxima_tenant_tenant_a,proxima_tenant_tenant_b,proxima_tenant_tenant_c;

COMMIT;
