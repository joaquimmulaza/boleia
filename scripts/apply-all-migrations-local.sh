#!/usr/bin/env bash
# Aplica todas as migrações em ordem lexicográfica (uso local / prova PG).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${1:?usage: apply-all-migrations-local.sh DBNAME}"

PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB")

echo "==> Bootstrap Supabase-like"
"${PSQL[@]}" -f "${ROOT}/supabase/tests/bootstrap_local_supabase.sql"

echo "==> Migrações (ordem lexicográfica)"
shopt -s nullglob
for f in "${ROOT}"/supabase/migrations/*.sql; do
  base="$(basename "$f")"
  echo "    -> ${base}"
  mig_src="$f"
  if [[ "$base" == "20260329161035_remote_schema.sql" ]]; then
    mig_src="/tmp/${base}.localfix.sql"
    perl "${ROOT}/supabase/tests/localfix_migration_sql.pl" <"$f" >"$mig_src"
  fi
  if ! "${PSQL[@]}" -f "$mig_src" >/tmp/mig_"${base}".log 2>&1; then
    echo "FALHOU: ${base}" >&2
    tail -30 /tmp/mig_"${base}".log >&2
    exit 4
  fi
done

echo "==> Todas as migrações aplicadas."
