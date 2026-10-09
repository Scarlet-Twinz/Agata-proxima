#!/usr/bin/env bash
set -euo pipefail
umask 077

required=(PGHOST PGDATABASE PGUSER PGPASSFILE)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "FAIL: $name must be configured in the protected operator environment." >&2
    exit 2
  fi
done
export PGPORT="${PGPORT:-5432}"

if [[ ! -f "$PGPASSFILE" ]]; then
  echo "FAIL: PGPASSFILE must point to an existing protected password file." >&2
  exit 2
fi
chmod 600 "$PGPASSFILE" 2>/dev/null || true

command -v pg_dump >/dev/null 2>&1 || { echo "FAIL: pg_dump is required." >&2; exit 2; }
command -v pg_restore >/dev/null 2>&1 || { echo "FAIL: pg_restore is required." >&2; exit 2; }

backup_dir="${BACKUP_DIR:-backups/control-plane}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir" 2>/dev/null || true
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/control-plane-$timestamp.dump"

echo "Creating PostgreSQL custom-format backup: $backup_file"
pg_dump --no-password --format=custom --no-owner --no-acl \
  --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --dbname="$PGDATABASE" --file="$backup_file"

echo "Validating archive index..."
pg_restore --list "$backup_file" >/dev/null

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$backup_file"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$backup_file"
fi

echo "PASS: backup archive created and readable. Copy it only to approved encrypted storage."
echo "NOTE: a backup is not a restore test; follow docs/production/operational-readiness-runbook.md."
