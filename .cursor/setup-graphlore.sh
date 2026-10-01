#!/usr/bin/env bash
# Bootstrap idempotente: graphifyy + graphlore + grafo AST local (sem LLM).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

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
  if ! command -v graphify >/dev/null 2>&1; then
    echo "[setup-graphlore] A instalar graphifyy..."
    uv tool install graphifyy
  fi
  if ! command -v graphlore >/dev/null 2>&1; then
    echo "[setup-graphlore] A instalar graphlore..."
    uv tool install graphlore --from "git+https://github.com/yasinyaman/graphlore.git"
  fi
  # Cursor pode não herdar ~/.local/bin no spawn do MCP.
  if [ -w /usr/local/bin ]; then
    ln -sf "${HOME}/.local/bin/graphlore" /usr/local/bin/graphlore 2>/dev/null || true
    ln -sf "${HOME}/.local/bin/graphify" /usr/local/bin/graphify 2>/dev/null || true
  fi
}

build_graph() {
  export PATH="${HOME}/.local/bin:${PATH}"
  if [ ! -f graphify-out/graph.json ]; then
    echo "[setup-graphlore] A gerar grafo AST (--code-only)..."
    graphify "${ROOT}" --code-only
    graphify cluster-only "${ROOT}"
    return 0
  fi
  echo "[setup-graphlore] graphify-out/graph.json já existe — mantido."
}

ensure_uv
ensure_tools
build_graph

echo "[setup-graphlore] Concluído. graphlore=$(command -v graphlore || echo 'n/a')"
