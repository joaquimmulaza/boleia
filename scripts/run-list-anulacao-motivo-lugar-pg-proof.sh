#!/usr/bin/env bash
# Prova PG: privacidade list_anulacao_motivo_lugar_acordos (FAIL-on-old em 4e587db).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/list_anulacao_motivo_lugar_privacy_pg_proof.sql"
BOOT="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
AUTH="${ROOT}/supabase/tests/bootstrap_p0_auth_overrides.sql"
PGPORT="${PGPORT:-5432}"
export PGPORT

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado." >&2
  exit 2
fi

if ! sudo -u postgres psql -p "${PGPORT}" -c 'SELECT 1' postgres >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start || sudo service postgresql start || true
fi

DB="list_anulacao_motivo_proof_$$"
cleanup() {
  sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
PSQL=(sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${DB}")

"${PSQL[@]}" -f "${ROOT}/supabase/tests/bootstrap_roles_first.sql"
"${PSQL[@]}" -f "${BOOT}"
"${PSQL[@]}" -f "${AUTH}"

shopt -s nullglob
for f in "${ROOT}"/supabase/migrations/*.sql; do
  echo "       -> $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "==> Asserções privacidade RPC"
"${PSQL[@]}" -f "${PROOF_SQL}"

echo "==> Prova list_anulacao_motivo concluída (exit 0)"
