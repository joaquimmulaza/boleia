# Contexto vivo — Boleia Certa

Fonte de verdade arquitectónica e de estado: **`AGENTS.md`** (relatório na secção 9).

**2026-10-04 — Confirmação de email:** `config.toml` `[auth.email] enable_confirmations = true`. O registo só abre o hub se `signUp` devolver sessão. Palavra-passe vazada (`password_hibp_enabled`) não cabe no CLI; o Dashboard do projecto alojado ainda não foi ligado. Spec `.specs/quick/auth-confirmacao-email/`.

**2026-10-02 — Cantos inferiores dos sheets:** `OverlayShell` bottom com margem 12px / `16px + safe-area` e raio 34px, no estilo do cartão Find My. Folga interior `pb-sheet` (2.5rem) num filho do scroll. Sheets de alerta (instruções PWA, actualização, convite e permissões) fecham ao deslizar para baixo. Spec `.specs/quick/sheet-bottom-radius/`.

**2026-09-10 — Preview reconcile #2:** `supabase/migrations/` = 61 versões remotas (MCP produção). Sem DDL. Spec `.specs/quick/supabase-preview-reconcile-2/`.

**2026-09-08 — Editar/cancelar procura:** RPC `update_procura` / `cancel_procura`; spec `.specs/features/editar-procura/`.

## UX / UI (resumo)

- **Penpot** = fonte de verdade do design. Antes de criar/alterar UI, consultar componentes, estilos e tokens existentes e privilegiar reutilização.
- **Superdesign** = exploração visual opcional; consolidar sempre no Penpot.
- **Cursor** = análise UX + implementação + Visual QA.
- Só implementar após o gate **design pronto**: user flow definido, estados principais cobertos, componentes identificados, telas consolidadas no Penpot.

Detalhe do fluxo A–E: `AGENTS.md` §4. Regras de código: `.cursorrules`.
