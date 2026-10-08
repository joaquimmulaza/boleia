#!/usr/bin/env bash
# Prova PostgreSQL local: migrations 142100+142200 sem recursão RLS 42P17.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="smoke_3a_rls_proof_$$"

cleanup() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Criar base de teste ${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\";" postgres

echo "==> Aplicar bootstrap + migrations + asserts"
cd "${ROOT}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f supabase/tests/smoke_3a_is_test_rls_pg_proof.sql

echo "==> Prova concluída com sucesso"
