# Auditoria Graphify + Graphlore — Boleia Certa

**Data:** 2026-09-05  
**Âmbito:** `C:\boleia-certa`  
**Plano de referência:** `.cursor/plans/graphify_update_workflow_a4a7d50a.plan.md`  
**Princípios:** `graph-doc.md` + guia Ashok (MCP-first, um só MCP Graphlore, hooks, `graphify-out/` gitignored)  
**Veredicto:** **PASS com gaps**

---

## 1. Sumário executivo

A integração operacional está **funcional**: extracção AST presente, MCP Graphlore lean activo no Cursor, hooks git instalados, `graphify-out/` ignorado e fora do índice, script `npm run graphify:update`, regra always-on e domínio marketplace (serviços canónicos) visível no grafo. `RouteService` **ausente**.

Os gaps restantes são de **higiene e alinhamento**: ruído no corpus (`skills/`, `package.json`, SQL legado com `routes`), freshness STALE face a working tree, `GRAPH_REPORT.md` desactualizado face ao último update incremental, extras em falta (`tree_sitter_sql`, `semble`, `tiktoken`), e **288 deletes staged** de `graphify-out/` à espera de commit. Durante esta auditoria corrigiu-se o desalinhamento P0 dos nomes de tools nas regras/`AGENTS.md` (lean vs locate/fetch/skeleton).

---

## 2. Matriz de verificação

| Item | Status | Evidência |
|------|--------|-----------|
| **A1.** `.graphifyignore` produto-first | **PASS parcial** | Existe; exclui `.agent/`, `.agents/`, `.cursor/`, `node_modules/`, `dist/`, caches, HTML gerados. Inclui implicitamente `src/`, `supabase/`, `AGENTS.md`, `.cursorrules`, `.specs/`. **Gap:** `skills/` (Stitch vendor na raiz) **não** está ignorado → God Nodes / surpresas Stitch. |
| **A2.** `graphify-out/graph.json` | **PASS** | Existe; ~688 542 bytes; mtime `2026-09-05T21:16:32+01:00`. MCP overview: **602 nós · 1241 arestas · 55 comunidades**. |
| **A3.** `GRAPH_REPORT.md` | **PASS parcial** | Existe (~8 764 bytes); útil (God Nodes, ciclos, surpresas). Header: *cluster-only mode*; mtime `20:58` — **mais antigo** que `graph.json` (21:16). Contagens report (606/1242/59) ≠ live MCP (602/1241/55). |
| **A4.** Domínio canónico / sem RouteService | **PASS** | `graphlore_search`: `OfertaService.js`, `AgreementService.js`, `MatchingService.js`, `ProcuraService.js`, `PropostaService.js` presentes. `RouteService` → *"No nodes match"*. Nota: migrações SQL ainda referem `"public"."routes"` / `Table: routes` (histórico Supabase — esperado). |
| **A5.** Install graphifyy + graphlore | **PASS** | `uv tool list`: `graphifyy v0.9.54`, `graphlore v0.2.0`. CLI: `graphify 0.9.54`, `graphlore v0.2.0`. Graphlore via Git: `uv-receipt.toml` → `git = "https://github.com/yasinyaman/graphlore.git"` + extras `treesitter`. |
| **B1.** `.cursor/mcp.json` + `.mcp.json` lean | **PASS** | Ambos com único server `graphlore`; env `GRAPHLORE_PROJECT_DIR=C:\boleia-certa`, `OUT_DIR=graphify-out`, `TOOLSET=lean`. Sem `code-review-graph` / `graphify.serve`. |
| **B2.** Env GRAPHLORE_* | **PASS** | Ver snippet MCP acima. |
| **B3.** Tools MCP disponíveis | **PASS** | Namespace `project-0-boleia-certa-graphlore` **ready**. Tools lean: `build`, `communities`, `freshness`, `neighbors`, `node_details`, `overview`, `search`, `subgraph` (+ `mcp_auth`). **Não** expostos: locate, fetch, skeleton, impact, query. |
| **B4.** Freshness pós-update | **WARN** | `graphlore_freshness`: `built_at_commit=8603aa690e` = HEAD; `stale=true`; `recommended_action=update` (17 ficheiros estruturais uncommitted + docs/rules). |
| **C1.** `graphify-out/` em `.gitignore` | **PASS** | Linhas 86–87: comentário + `graphify-out/`. |
| **C2.** Não tracked no índice | **PASS** | `git ls-files graphify-out` → `tracked_count=0`. |
| **C3.** Hooks post-commit / post-checkout | **PASS** | Ambos com `# Installed by: graphify hook install`; markers `graphify-hook-start` / `graphify-checkout-hook-start`; pin Python uv tools. |
| **C4.** Script `graphify:update` | **PASS** | `package.json`: `"graphify:update": "graphify update ."`. |
| **C5.** Staged `git rm --cached` | **WARN** | **288** paths staged como `D` sob `graphify-out/` — commit pendente (grande). Working tree local mantém artefactos. |
| **D1.** `graphify.mdc` alwaysApply + MCP-before-Grep | **PASS** (corrigido nesta auditoria) | `alwaysApply: true`; ordem MCP → Grep. Tools alinhados ao lean. |
| **D2.** `AGENTS.md` Graphify+Graphlore + install Git | **PASS** (corrigido nesta auditoria) | §1.1 documenta PyPI `graphifyy`, Git URL Graphlore, toolset lean. |
| **D3.** multi-agent-loop / orchestrator | **PASS parcial** | `multi-agent-loop.mdc` menciona Graphlore (alinhado lean). Orchestrator só: *"explore / graphify"* — sem passo freshness/overview explícito. |
| **D4.** Alinhamento nomes tools lean | **PASS** (corrigido) | Antes: rules/AGENTS citavam locate/fetch/skeleton/impact. Depois: overview/search/subgraph/neighbors/node_details. Descrição MCP ainda menciona `graphlore_locate` (marketing do server; tool ausente no lean). |
| **E.** Gaps conhecidos revalidados | ver §3 | — |

---

## 3. Gaps priorizados

### P0 — fechar cedo

| Gap | Acção recomendada |
|-----|-------------------|
| **Commit pendente: 288 deletes staged de `graphify-out/`** | Quando o utilizador pedir commit: incluir só o untrack (`git rm --cached` já staged) + configs (mcp, gitignore, rules) — **não** re-adicionar `graphify-out/`. Avisar tamanho do commit. |
| **Freshness STALE (código uncommitted)** | Após estabilizar working tree: `graphlore_build(update=True, code_only=True)` ou `npm run graphify:update`. |

### P1 — qualidade do grafo / DX agentes

| Gap | Acção recomendada |
|-----|-------------------|
| **`skills/` na raiz indexado** (Stitch/Remotion) | Adicionar `skills/` a `.graphifyignore`; rebuild limpo. God Nodes/surpresas deixam de ser skills vendor. |
| **`GRAPH_REPORT.md` desactualizado** (cluster-only / contagens velhas) | Após update: regenerar report completo (`graphify` extract/report ou `cluster_only` + refresh docs); não confiar só no HTML/report antigo. |
| **Ruído `package.json` / communities de deps** | Apertar ignore ou excluir manifests de tooling se não forem necessários à navegação de produto. |
| **`tree_sitter_sql` em falta** | `uv tool install "graphlore[treesitter]" --from git+…` já tem treesitter genérico; instalar grammar SQL se quiserem spans SQL precisos nas migrações. |
| **Sem `semble` → locate limitado / ausente no lean** | Opcional: instalar extra `semble` **e/ou** toolset `full` se precisarem de locate semântico; senão manter `search` + documentar (já feito). |
| **Orchestrator fraco no passo grafo** | Em `boleia-agent-loop/orchestrator/SKILL.md`: exigir `graphlore_overview`/`freshness` antes de explore/Grep em tarefas de arquitectura. |

### P2 — nice-to-have

| Gap | Acção recomendada |
|-----|-------------------|
| **SQL legado `routes` no grafo** | Aceitar como história DDL **ou** filtrar migrações antigas no ignore se confundirem agentes. |
| **Descrição MCP menciona `graphlore_locate`** | Upstream Graphlore / aceitar; agents devem seguir rules locais lean. |
| **`tiktoken` ausente** | Opcional `GRAPHLORE_TOKENIZER=tiktoken` + extra para budgets exactos em `subgraph`. |
| **Warning skill Gemini graphify 0.9.50 vs package 0.9.54** | `graphify install --platform antigravity` (ou platforms usadas) se quiserem skills CLI alinhadas — fora do Cursor always-on. |
| **Confirmar `graphify cursor install`** | Rule `.cursor/rules/graphify.mdc` existe com `alwaysApply` (equivalente ao objectivo do install). Re-correr `graphify cursor install` só se quiserem refresh automático da skill vendor. |

---

## 4. Smoke MCP

Namespace: `project-0-boleia-certa-graphlore` — **ready**.

| Tool | Resultado |
|------|-----------|
| `graphlore_overview` | 602 nodes, 1241 edges, 55 communities; god nodes: `PassengerDashboard.jsx` (49), `DriverDashboard.jsx` (44), `supabase`/`supabase.js` (39), `MyAgreements.jsx` (36), `App.jsx` (32), `GrupoService.js` (29)… Domínio Boleia — **não** GET()/logger. |
| `graphlore_freshness` | stale; HEAD=`8603aa690e`=built_at; recommend `update`. |
| `graphlore_search("RouteService")` | sem matches. |
| `graphlore_search` (serviços canónicos) | Oferta / Agreement / Matching / Procura / Proposta — OK. |
| `graphlore_subgraph("AgreementService.js")` | 23 nós / imports contains leave/renegotiate/accept — OK. |
| `graphlore_node_details("OfertaService.js")` | file=`src/services/OfertaService.js`, origin=ast. |
| `graphlore_communities` | hubs auth/layout, marketplace dashboards, acordos, grupo, faltas, publish, geo/matching; **ruído** skills Stitch + package.json. |

**Critério Ashok (arquitectura → MCP, não Grep):** cumprido nesta auditoria.

---

## 5. Conclusão e próximos passos

### Conclusão

O plano Graphify update workflow está **largamente implementado**: extracção, MCP único lean, hooks, gitignore, governança MCP-first. O grafo reflecte o marketplace actual (sem `RouteService` de frontend). Veredicto **PASS com gaps** — bloqueios reais são sobretudo **commit do untrack** e **refresh** após código uncommitted, mais higiene de ignore (`skills/`).

### Alterações feitas nesta auditoria (docs/rules apenas)

- `.cursor/rules/graphify.mdc` — ordem e nomes alinhados ao toolset **lean**.
- `.cursor/rules/multi-agent-loop.mdc` — idem.
- `AGENTS.md` §1.1 — tools lean + nota de install Graphlore via **Git**.

**Não** se fez commit. **Não** se alterou código de produção da app.

### Próximos passos sugeridos (ordem)

1. Pedir commit do untrack `graphify-out/` + configs Graphlore (quando conveniente).
2. Acrescentar `skills/` a `.graphifyignore` e rebuild `code_only`.
3. `graphlore_build(update=True)` / `npm run graphify:update` após merge do working tree.
4. Regenerar `GRAPH_REPORT.md` e validar God Nodes só de produto.
5. (Opcional) reforçar orchestrator skill; extras `semble` / SQL / tiktoken.

---

*Auditoria gerada por agente Cursor — evidência MCP + filesystem + git em 2026-09-05.*

## P1 follow-up (2026-09-05, fechamento)

### Fechado nesta passagem
- **.graphifyignore:** acrescentado skills/ (packs Stitch/Remotion na raiz) e package.json (ru�do de communities de deps). Mant�m produto-first: src/, supabase/, AGENTS.md, .cursorrules, .specs/ continuam eleg�veis; .cursor/ j� exclu�a skills de agentes.
- **Rebuild limpo:** graphify extract . --code-only --force + graphify cluster-only . --no-viz � podou n�s de ficheiros exclu�dos; GRAPH_REPORT.md regenerado.
- **Stats p�s-rebuild:** ~466 nodes, ~1119 edges, 39 communities (code-only; sem pass sem�ntico nesta corrida).
- **Git:** graphify-out/ no .gitignore + remo��o do �ndice (ficheiros locais mantidos); commit de infra Graphify/Graphlore (ignore, regras, audit, untrack).
- **Orchestrator:** linha de explora��o exige Graphlore (overview/reshness ? search ? subgraph) antes de Grep.
- **Regras / AGENTS:** graphify.mdc + multi-agent-loop alinhados ao MCP lean Graphlore.

### Residual (n�o fechado / opcional)
- **STALE non-code:** extract --code-only n�o actualiza camada sem�ntica de docs/specs; ap�s mudan�as em .md/.specs/ correr 
pm run graphify:update (ou extract sem --code-only) quando fizer sentido.
- **semble:** toolset lean sem locate sem�ntico; opcional instalar extra semble e/ou GRAPHLORE_TOOLSET=full.
- **	ree_sitter_sql:** 4 ficheiros .sql sem contribui��o ao grafo � instalar pip install "graphifyy[sql]" (ou grammar SQL no Graphlore) se quiserem spans de migra��es.
- **Labels de communities:** cluster-only sem LLM ? placeholders �Community N� at� haver backend/API key.
- **UTF-8:** .graphifyignore regravado em UTF-8 ap�s aviso cp1252 no extract.

