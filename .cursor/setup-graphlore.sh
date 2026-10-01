#!/usr/bin/env bash
# Bootstrap idempotente: graphifyy[gemini] + graphlore + grafo (AST + docs via Gemini).
# Chave: GOOGLE_API_KEY ou GEMINI_API_KEY (secret Cursor Cloud — nunca commitar).
# Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
# Graphify: GRAPHIFY_MAX_RETRIES (429/Retry-After), --max-concurrency (chunks LLM).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# Conservador para tier free Gemini (RPM/TPM/RPD); subir só se AI Studio permitir.
export GRAPHIFY_MAX_RETRIES="${GRAPHIFY_MAX_RETRIES:-8}"
GRAPHIFY_MAX_CONCURRENCY="${GRAPHIFY_MAX_CONCURRENCY:-2}"
GRAPHIFY_LABEL_CONCURRENCY="${GRAPHIFY_LABEL_CONCURRENCY:-1}"

resolve_llm_key() {
  if [ -n "${GOOGLE_API_KEY:-}" ]; then
    export GOOGLE_API_KEY
    return 0
  fi
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    export GOOGLE_API_KEY="${GEMINI_API_KEY}"
    return 0
  fi
  if [ -f .env.local ]; then
    # shellcheck disable=SC1091
    set +u
    # shellcheck source=/dev/null
    source <(grep -E '^(GOOGLE_API_KEY|GEMINI_API_KEY)=' .env.local | sed 's/^/export /')
    set -u
    if [ -n "${GOOGLE_API_KEY:-}" ] || [ -n "${GEMINI_API_KEY:-}" ]; then
      export GOOGLE_API_KEY="${GOOGLE_API_KEY:-${GEMINI_API_KEY}}"
      return 0
    fi
  fi
  return 1
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return 0
  fi
  echo "[setup-graphlore] A instalar uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
}

ensure_tools() {
  export PATH="${HOME}/.local/bin:${PATH}"
  echo "[setup-graphlore] A garantir graphifyy[gemini]..."
  uv tool install "graphifyy[gemini]" --force
  if ! command -v graphlore >/dev/null 2>&1; then
    echo "[setup-graphlore] A instalar graphlore..."
    uv tool install graphlore --from "git+https://github.com/yasinyaman/graphlore.git"
  fi
  if [ -w /usr/local/bin ]; then
    ln -sf "${HOME}/.local/bin/graphlore" /usr/local/bin/graphlore 2>/dev/null || true
    ln -sf "${HOME}/.local/bin/graphify" /usr/local/bin/graphify 2>/dev/null || true
  fi
}

install_cursor_rules() {
  export PATH="${HOME}/.local/bin:${PATH}"
  graphify cursor install 2>/dev/null || echo "[setup-graphlore] graphify cursor install ignorado (sem TTY)."
}

build_graph() {
  export PATH="${HOME}/.local/bin:${PATH}"

  if resolve_llm_key; then
    echo "[setup-graphlore] Gemini disponível — extração AST + docs (max-concurrency=${GRAPHIFY_MAX_CONCURRENCY})..."
    if [ -f graphify-out/graph.json ]; then
      graphify update "${ROOT}" \
        || graphify "${ROOT}" --backend gemini --max-concurrency "${GRAPHIFY_MAX_CONCURRENCY}"
    else
      graphify "${ROOT}" --backend gemini --max-concurrency "${GRAPHIFY_MAX_CONCURRENCY}"
    fi
    graphify cluster-only "${ROOT}" --backend gemini --max-concurrency "${GRAPHIFY_LABEL_CONCURRENCY}" \
      || graphify cluster-only "${ROOT}"
    return 0
  fi

  echo "[setup-graphlore] GOOGLE_API_KEY ausente — fallback AST (--code-only)."
  if [ ! -f graphify-out/graph.json ]; then
    graphify "${ROOT}" --code-only
    graphify cluster-only "${ROOT}"
  else
    echo "[setup-graphlore] graphify-out/graph.json existente — mantido."
  fi
}

ensure_uv
ensure_tools
install_cursor_rules
build_graph

echo "[setup-graphlore] Concluído. graphlore=$(command -v graphlore || echo 'n/a')"
