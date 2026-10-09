#!/usr/bin/env bash
# Diff normalizado: leave_passenger em 190000 vs 200000 (só bloco $function$).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M190="${ROOT}/supabase/migrations/20261009190000_leave_passenger_reservado_saiu.sql"
M200="${ROOT}/supabase/migrations/20261009200000_p1_encerramento_gaps.sql"
OUT="${1:-/opt/cursor/artifacts/p1-leave-body-diff.txt}"

extract_body() {
  perl -0777 -ne '
    if (/CREATE OR REPLACE FUNCTION public\.leave_passenger.*?AS \$function\$(.*?)\$function\$/s) {
      my $b = $1;
      $b =~ s/^\s+|\s+$//g;
      print $b;
    }
  ' "$1"
}

mkdir -p "$(dirname "$OUT")"
{
  echo "# leave_passenger body diff: 190000 (base) vs 200000 (P1)"
  echo "# Allowed hunks: v_estado_acordo + notification block + v_uid driver guard"
  diff -u \
    <(extract_body "$M190") \
    <(extract_body "$M200") \
    || true
} > "$OUT"

echo "Wrote $OUT"
