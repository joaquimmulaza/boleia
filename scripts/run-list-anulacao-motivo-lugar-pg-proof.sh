#!/usr/bin/env bash
# Prova PG: privacidade list_anulacao_motivo_lugar_acordos (FAIL-on-old em 3052d44).
# PGVERSION/PGPORT configuráveis (CI usa PG17; local pode usar PG16 com PGVERSION=16).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/list_anulacao_motivo_lugar_privacy_pg_proof.sql"
BOOT="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
AUTH="${ROOT}/supabase/tests/bootstrap_p0_auth_overrides.sql"
MIG_RPC="20261009191000_list_anulacao_motivo_lugar_acordo.sql"
PGVERSION="${PGVERSION:-17}"
PGPORT="${PGPORT:-5432}"
PGCLUSTER="${PGCLUSTER:-${PGVERSION}/main}"
# FAIL_RPC_GIT_REF=3052d44 — reaplica RPC antiga e espera falha na prova (artefacto fail-rpc).
FAIL_RPC_GIT_REF="${FAIL_RPC_GIT_REF:-}"
export PGPORT

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado." >&2
  exit 2
fi

start_pg() {
  if sudo -u postgres psql -p "${PGPORT}" -c 'SELECT 1' postgres >/dev/null 2>&1; then
    return 0
  fi
  echo "==> A arrancar PostgreSQL ${PGCLUSTER} (porta ${PGPORT})..."
  if command -v pg_ctlcluster >/dev/null 2>&1 && [[ -d "/etc/postgresql/${PGVERSION}/main" ]]; then
    sudo pg_ctlcluster "${PGVERSION}" main start
  else
    echo "AVISO: cluster ${PGCLUSTER} indisponível; tentar service postgresql." >&2
    sudo service postgresql start || true
  fi
}

start_pg

DB="list_anulacao_motivo_proof_$$"
cleanup() {
  sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
PSQL=(sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${DB}")

apply_migrations() {
  "${PSQL[@]}" -f "${ROOT}/supabase/tests/bootstrap_roles_first.sql"
  "${PSQL[@]}" -f "${BOOT}"
  "${PSQL[@]}" -f "${AUTH}"

  shopt -s nullglob
  for f in "${ROOT}"/supabase/migrations/*.sql; do
    base="$(basename "$f")"
    echo "       -> ${base}"
    mig_src="$f"
    if [[ "$base" == "20260329161035_remote_schema.sql" ]]; then
      mig_src="/tmp/${base}.localfix.$$"
      perl "${ROOT}/supabase/tests/localfix_migration_sql.pl" <"$f" >"$mig_src"
    fi
    "${PSQL[@]}" -f "$mig_src"
    if [[ "$mig_src" != "$f" ]]; then
      rm -f "$mig_src"
    fi
  done
}

apply_migrations

if [[ -n "${FAIL_RPC_GIT_REF}" ]]; then
  echo "==> FAIL-on-old: RPC @ ${FAIL_RPC_GIT_REF}"
  OLD_RPC="/tmp/list_anulacao_motivo_${FAIL_RPC_GIT_REF}.sql"
  git show "${FAIL_RPC_GIT_REF}:supabase/migrations/${MIG_RPC}" >"${OLD_RPC}"
  "${PSQL[@]}" -f "${OLD_RPC}"
  rm -f "${OLD_RPC}"
  set +e
  "${PSQL[@]}" -f "${PROOF_SQL}"
  proof_exit=$?
  set -e
  if [[ "${proof_exit}" -eq 0 ]]; then
    echo "ERRO: prova devia FALHAR com RPC ${FAIL_RPC_GIT_REF} (exit 0 inesperado)." >&2
    exit 5
  fi
  echo "==> Prova falhou como esperado com RPC ${FAIL_RPC_GIT_REF} (exit ${proof_exit})"
  exit 0
fi

echo "==> Asserções privacidade RPC (PG ${PGVERSION}, porta ${PGPORT})"
"${PSQL[@]}" -f "${PROOF_SQL}"

echo "==> Prova list_anulacao_motivo concluída (exit 0)"
