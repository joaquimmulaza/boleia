#!/usr/bin/env bash
# Prova PostgreSQL local: sec_default_privileges (20261009160000).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="sec_default_priv_proof_$$"
SQL_FILE="${ROOT}/supabase/tests/sec_default_privileges_pg_proof.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql não encontrado — prova PG não executada neste ambiente." >&2
  exit 2
fi

PSQL=(psql -v ON_ERROR_STOP=1)
if id postgres &>/dev/null; then
  PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)
fi

cleanup() {
  "${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Criar base de teste ${DB_NAME}"
"${PSQL[@]}" -c "CREATE DATABASE \"${DB_NAME}\";" postgres

echo "==> Bootstrap + migração + asserções"
cd "${ROOT}"
"${PSQL[@]}" -d "${DB_NAME}" -f "${SQL_FILE}"

echo "==> Prova concluída com sucesso (exit 0)"
