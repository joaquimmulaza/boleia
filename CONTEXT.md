# Contexto vivo — Boleia Certa

Fonte de verdade arquitectónica e de estado: **`AGENTS.md`** (relatório na secção 9).

**2026-09-10 — Preview reconcile #2:** `supabase/migrations/` = 61 versões remotas (MCP produção). Sem DDL. Spec `.specs/quick/supabase-preview-reconcile-2/`.

**2026-09-08 — Editar/cancelar procura:** RPC `update_procura` / `cancel_procura`; spec `.specs/features/editar-procura/`.

## UX / UI (resumo)

- **Penpot** = fonte de verdade do design. Antes de criar/alterar UI, consultar componentes, estilos e tokens existentes e privilegiar reutilização.
- **Superdesign** = exploração visual opcional; consolidar sempre no Penpot.
- **Cursor** = análise UX + implementação + Visual QA.
- Só implementar após o gate **design pronto**: user flow definido, estados principais cobertos, componentes identificados, telas consolidadas no Penpot.

Detalhe do fluxo A–E: `AGENTS.md` §4. Regras de código: `.cursorrules`.
