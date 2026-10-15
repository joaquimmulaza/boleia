---
trigger: always_on
description: Consult hosted Graphify MCP first; local graphify-out/ and Graphlore are fallbacks.
---

## graphify

**Primary:** hosted Graphify MCP on repo `joaquimmulaza/boleia` — mandatory sequence before editing `src/` symbols: `graphify_find` / `graphify_node` → `graphify_callers` / `graphify_callees` → `graphify_impact` or `impact_and_risk` → `graphify_tests_for`; `graph_stats` for indexed commit.

If no `graphify_*` tools are listed in the session, say so explicitly and fall back to `rg`. Always confirm with `rg` what the graph misses: `supabase.rpc('…')` string calls, dynamic imports, routes.

**Fallback — local CLI:** when `graphify-out/graph.json` exists, `graphify query "<question>"`, `graphify path`, `graphify explain`; after code edits run `npm run graphify:update` (`graphify update .` — no invalid flags on `update`).

**Fallback — Graphlore:** stdio MCP in `.cursor/mcp.json` (lean toolset; `${workspaceFolder}` / `${workspaceFolder}/graphify-out`). Use only if hosted Graphify is unavailable.

Read `graphify-out/GRAPH_REPORT.md` only for broad architecture when MCP/CLI subgraph is insufficient.
