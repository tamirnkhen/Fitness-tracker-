#!/usr/bin/env bash
# Applies the migration to a throwaway Postgres database (with a small Supabase
# shim) and runs the security/game-logic tests in supabase/tests/db_test.sql.
# Usage: scripts/test-db.sh   (needs psql + a reachable server; PG* env vars apply)
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${TEST_DB:-quest_test_$$}"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "create extension if not exists pgcrypto;" -f supabase/tests/supabase_shim.sql
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/db_test.sql
