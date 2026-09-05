# Smoke audit — Stitch + UI Skills sync

**Data:** 2026-09-05  
**Plano:** Stitch UI Skills sync (`stitch_ui_skills_sync_b9b95fa2`)  
**Veredicto:** **PASS com gaps** (governança sincronizada; Stitch MCP OK; UI Skills MCP timeout de transporte)

---

## 1. Sumário

| Área | Status |
|------|--------|
| Rules / AGENTS / agent skills | **PASS** — Stitch SoT + UI Skills sync; v0 fallback; bans “Stitch descontinuado” removidos dos paths activos |
| Ponte `boleia-stitch` | **PASS** — criada; aponta a `skills/` + overrides JSX |
| MCP `user-stitch` | **PASS** — `namespaceStatus: ready`; `mcp_auth` OK; tools expostas |
| MCP `user-UI Skills MCP` | **GAP** — `ready` no catálogo; `list_skills` / `get_skill` **timeout** após reauth |
| Projectos Stitch | **INFO** — `list_projects` → `{}` (zero owned ou resposta vazia) |

---

## 2. Matriz de verificação

| Item | Status | Evidência |
|------|--------|-----------|
| `.cursor/rules/ui-stack.mdc` Stitch + UI Skills | PASS | Título “Stitch + UI Skills sync”; ordem UI Skills → Stitch → shadcn |
| `.cursorrules` §8 UI | PASS | “Stitch + UI Skills sync”; anti-padrões anti dump HTML / só-Stitch |
| `AGENTS.md` §4 | PASS | Fluxo A–F com C = Design Stitch; REGRA DE OURO actualizada |
| `multi-agent-loop.mdc` | PASS | Despacho UI menciona Stitch/`boleia-stitch` |
| `ui-designer` exige UI Skills antes de Stitch | PASS | Passo 2 UI Skills; gate exige evidência UI Skills |
| `ui-qa` reconsulta UI Skills + Stitch | PASS | Passos 2–3 |
| `orchestrator` gate sem v0 obrigatório | PASS | Design pronto = Stitch + UI Skills + shadcn |
| `.cursor/skills/boleia-stitch/SKILL.md` | PASS | Ponte + overrides sem TS |
| Grep “Stitch descontinuado” / “v0-first” em rules activas | PASS | Sem matches em `AGENTS.md`, `.cursorrules`, `ui-stack.mdc` |
| Stitch `mcp_auth` | PASS | “Successfully authenticated MCP server: user-stitch” |
| Stitch `list_projects` (`view=owned` e sem filtro) | PASS (vazio) | `{}` — 0 projectos owned |
| UI Skills `list_skills` / `get_skill` | FAIL transporte | Timeout `user-UI Skills MCP::mcpScope:...` (após `mcp_auth` OK) |

---

## 3. Dry-run fluxo A–F (sem gerar ecrã)

Ordem documentada e consistente em `ui-stack.mdc` + `ui-designer` + `boleia-stitch`:

0 Spec → A UX → B UI Skills → C Stitch (`enhance-prompt` / `DESIGN.md`) → D shadcn → Gate → E TDD JSX → F UI QA (UI Skills + fidelidade Stitch).

**Não** se chamou `create_project` / `generate_screen_from_text` (evitar projectos órfãos sem ecrã-alvo confirmado).

---

## 4. Gaps residual (prioridade)

| P | Gap | Acção recomendada |
|---|-----|-------------------|
| P1 | UI Skills MCP timeout nas tools de leitura | Recarregar MCP no Cursor; confirmar plano/rede; re-testar `list_skills` + `get_skill ibelick/baseline-ui` |
| P2 | Zero projectos Stitch | Na próxima tarefa UI real: `create_project` (com confirmação) + primeiro ecrã smoke |
| P2 | Planos antigos em `.cursor/plans/*` ainda dizem v0-first | Histórico; ignorar ou actualizar só se reabertos |
| P3 | Vendor `react-components` ainda TS | Já coberto pelos overrides em `boleia-stitch` |

---

## 5. Critério de sucesso do plano

| Critério | Resultado |
|----------|-----------|
| Ambos os MCPs “respondem” | Stitch **sim** (auth + tools); UI Skills **auth sim**, tools **timeout** |
| Docs/rules mesma ordem | **Sim** |
| ui-designer exige UI Skills antes de Stitch | **Sim** |

**Conclusão:** integração de fluxo **sincronizada na governança**. Smoke Stitch **OK** (sem projectos). Smoke UI Skills **bloqueado por timeout de transporte** — requer reload/reauth no cliente Cursor pelo utilizador; depois revalidar `get_skill`.
