# Contexto vivo — Boleia Certa

Fonte de verdade arquitectónica e de estado: **`AGENTS.md`** (relatório na secção 9).

**2026-10-05 — Confirmação de email:** registo sem sessão fica em `/auth`; login `email_not_confirmed` pede para confirmar o email. `config.toml` liga `enable_confirmations` e `password_hibp_enabled`. Spec `.specs/quick/auth-confirmacao-email/`.

**2026-10-02 — Cantos inferiores dos sheets:** `OverlayShell` bottom com margem 12px / `16px + safe-area` e raio 34px, no estilo do cartão Find My. Folga interior `pb-sheet` (2.5rem) num filho do scroll. Sheets de alerta (instruções PWA, actualização, convite e permissões) fecham ao deslizar para baixo. Spec `.specs/quick/sheet-bottom-radius/`.

**2026-09-10 — Preview reconcile #2:** `supabase/migrations/` = 61 versões remotas (MCP produção). Sem DDL. Spec `.specs/quick/supabase-preview-reconcile-2/`.

**2026-09-08 — Editar/cancelar procura:** RPC `update_procura` / `cancel_procura`; spec `.specs/features/editar-procura/`.

## UX / UI (resumo)

- **Penpot** = fonte de verdade do design. Antes de criar/alterar UI, consultar componentes, estilos e tokens existentes e privilegiar reutilização.
- **Superdesign** = exploração visual opcional; consolidar sempre no Penpot.
- **Cursor** = análise UX + implementação + Visual QA.
- Só implementar após o gate **design pronto**: user flow definido, estados principais cobertos, componentes identificados, telas consolidadas no Penpot.

Detalhe do fluxo A–E: `AGENTS.md` §4. Regras de código: `.cursorrules`.
