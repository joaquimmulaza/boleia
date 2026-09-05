#!/usr/bin/env bash
set -euo pipefail

# Bootstrap idempotente do .env.local para o dev server / Cloud Agent.
# - Se .env.local já existir, mantém-no (não sobrescreve edições do utilizador).
# - Caso contrário, cria-o usando as variáveis VITE_* do ambiente (secrets) quando
#   presentes, ou placeholders que permitem arrancar a UI sem backend real.
# Para funcionalidade completa (Supabase), define VITE_SUPABASE_URL e
# VITE_SUPABASE_ANON_KEY como secrets do ambiente.

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  echo "[setup-local-env] .env.local já existe — mantido."
  exit 0
fi

cat > .env.local <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-https://placeholder.supabase.co}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-placeholder-anon-key}
VITE_SENTRY_DSN=${VITE_SENTRY_DSN:-}
VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY:-}
EOF

echo "[setup-local-env] .env.local criado."
