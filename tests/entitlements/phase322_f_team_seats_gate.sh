#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_team_seats_test"
: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=proxima}"
: "${PGPASSWORD:=proxima-dev-only}"
export PGHOST PGPORT PGUSER PGPASSWORD

psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS ${test_db}" >/dev/null
psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${test_db}" >/dev/null
for migration in "${root}"/*.sql; do
  psql -v ON_ERROR_STOP=1 -d "${test_db}" -f "${migration}" >/dev/null
done

org_a="a3000000-0000-4000-8000-000000000001"
org_b="a3000000-0000-4000-8000-000000000002"
org_c="a3000000-0000-4000-8000-000000000003"
org_d="a3000000-0000-4000-8000-000000000004"
user_1="b3000000-0000-4000-8000-000000000001"
user_2="b3000000-0000-4000-8000-000000000002"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO users(id,email,display_name,password_hash) VALUES
 ('${user_1}','owner@example.test','Owner','test-hash'),
 ('${user_2}','member@example.test','Member','test-hash');
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','Team Seat A','team-seat-a'),
 ('${org_b}','Team Seat B','team-seat-b'),
 ('${org_c}','Team Seat C','team-seat-c'),
 ('${org_d}','Team Seat D','team-seat-d');
UPDATE organization_entitlements SET team_seat_limit=2,billing_status='active'
 WHERE organization_id IN ('${org_a}','${org_b}','${org_c}','${org_d}');
INSERT INTO memberships(user_id,organization_id,role) VALUES
 ('${user_1}','${org_a}','owner'),
 ('${user_1}','${org_b}','owner'),
 ('${user_1}','${org_c}','owner'),
 ('${user_1}','${org_d}','owner');
SQL

new_org_ok=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT EXISTS(SELECT 1 FROM organization_entitlements WHERE organization_id='${org_d}' AND plan_key='free' AND team_seat_limit=1)")
# The test fixture above explicitly raises org_d's seat limit to two, so validate initialization on a fresh organization.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO organizations(id,name,slug) VALUES ('a3000000-0000-4000-8000-000000000005','Auto Entitlement','auto-entitlement')" >/dev/null
auto_entitlement=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT EXISTS(SELECT 1 FROM organization_entitlements WHERE organization_id='a3000000-0000-4000-8000-000000000005' AND plan_key='free' AND team_seat_limit=1)")
[[ "$auto_entitlement" == "t" ]] || fail "new organizations do not receive Free entitlements automatically"
pass "new organizations are initialized with a Free entitlement"

# An outstanding invitation reserves the last seat; accepting it atomically moves
# that reservation from pending invitation to membership without double-counting.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
VALUES ('c3000000-0000-4000-8000-000000000001',
        'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',
        'member@example.test','viewer',decode(repeat('a',64),'hex'),now()+interval '7 days');
BEGIN;
UPDATE organization_invites SET accepted_at=now()
 WHERE id='c3000000-0000-4000-8000-000000000001' AND accepted_at IS NULL;
INSERT INTO memberships(user_id,organization_id,role)
VALUES ('b3000000-0000-4000-8000-000000000002',
        'a3000000-0000-4000-8000-000000000001','viewer');
COMMIT;
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
    VALUES ('c3000000-0000-4000-8000-000000000002',
            'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',
            'third@example.test','viewer',decode(repeat('b',64),'hex'),now()+interval '7 days');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: team_seats%' THEN
    RAISE EXCEPTION 'Seat limit did not reject a third active member/invite: %', message_text;
  END IF;
END $$;
SQL
pass "accepting an invitation transfers a reserved seat atomically"

# Pending invitations count toward capacity; expired invitations do not.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
VALUES ('c3000000-0000-4000-8000-000000000003',
        'a3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',
        'pending@example.test','viewer',decode(repeat('c',64),'hex'),now()+interval '7 days');
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
    VALUES ('c3000000-0000-4000-8000-000000000004',
            'a3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',
            'another@example.test','viewer',decode(repeat('d',64),'hex'),now()+interval '7 days');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: team_seats%' THEN
    RAISE EXCEPTION 'Pending invitation was not counted against team capacity: %', message_text;
  END IF;
END $$;
INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
VALUES ('c3000000-0000-4000-8000-000000000005',
        'a3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001',
        'expired@example.test','viewer',decode(repeat('e',64),'hex'),now()-interval '1 minute');
INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
VALUES ('c3000000-0000-4000-8000-000000000006',
        'a3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001',
        'valid@example.test','viewer',decode(repeat('f',64),'hex'),now()+interval '7 days');
SQL
pass "pending invitations reserve seats and expired invitations do not"

# Missing entitlement state must fail closed for new invitations.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "DELETE FROM organization_entitlements WHERE organization_id='${org_c}'" >/dev/null
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
    VALUES ('c3000000-0000-4000-8000-000000000007',
            'a3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001',
            'no-entitlement@example.test','viewer',decode(repeat('0',64),'hex'),now()+interval '7 days');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_ENTITLEMENT_MISSING: team_seats%' THEN
    RAISE EXCEPTION 'Missing seat entitlement did not fail closed: %', message_text;
  END IF;
END $$;
SQL
pass "missing seat entitlement fails closed"

# Race two invitation inserts against the single remaining slot in org_d.
set +e
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at) VALUES ('c3000000-0000-4000-8000-000000000008','${org_d}','${user_1}','race-a@example.test','viewer',decode(repeat('8',64),'hex'),now()+interval '7 days')" >/tmp/phase322-f-race-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at) VALUES ('c3000000-0000-4000-8000-000000000009','${org_d}','${user_1}','race-b@example.test','viewer',decode(repeat('9',64),'hex'),now()+interval '7 days')" >/tmp/phase322-f-race-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if [[ $result_a -eq 0 && $result_b -eq 0 ]]; then
  fail "concurrent invitation creation exceeded team-seat capacity"
fi
if [[ $result_a -ne 0 && $result_b -ne 0 ]]; then
  cat /tmp/phase322-f-race-a.log /tmp/phase322-f-race-b.log >&2
  fail "both concurrent invitations failed; expected exactly one to succeed"
fi
pass "concurrent invitation creation cannot exceed seat capacity"

echo "PASS: Phase 3.22-F team-seat checks"
