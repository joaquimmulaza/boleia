# Boleia Certa Project Memory & State

## Current Active Milestone
- **Feature**: **Epic §22 — Ciclo de Vida Pós-Acordo** (adenda bilateral · rescisão · hardening de vagas)
- **Status**: **T0 + T1 + T2 + T3 + T4a/T4b Done** — SQL remoto, serviços TDD e UI (`TerminateAgreementModal` + CTAs bilaterais em `/acordos`) verdes (suites tocadas 44/44). **T4c (P3 matching) e T5 (ui-qa + code-reviewer) ainda Pending.**
- **Decisão (2026-09-06)**: Spec §22 **aprovada para Execute** após Task 0. Ordem XP obrigatória: Spec → Database → Services (TDD) → UI (Stitch) → Verificação. Sem geração one-shot; sem UI com serviços vermelhos.
- **Artefactos**: [`.specs/features/acordo-pos-acordo-s22/`](../features/acordo-pos-acordo-s22/spec.md) (`spec.md` · `design.md` · `tasks.md`)
- **Migração canónica**: `supabase/migrations/20260906150000_s22_bilateral_adenda_terminate_vagas.sql` (aplicada via Supabase MCP em 7 versões `s22_*`) + follow-up **`20260906160000_s22_rpc_grants_hardening.sql`** (MCP `s22_rpc_grants_hardening`, 2026-09-06) — `REVOKE anon` nas 4 RPCs de adenda; `apply_due_*` com `auth.uid()`; `recount_oferta_vagas` sem EXECUTE para clientes.
- **Plano**: `.cursor/plans/§22_rescisão_adenda_4901d05c.plan.md.md`
- **Bloqueio resolvido**: **S22-TM-08 / A1** — pro-rata é **excepção explícita** à quota congelada e vale **só** para `justa_causa`; documentado em AGENTS §7. Aviso prévio, consensual e `leave_passenger` mantêm quotas congeladas.
- **Contratos SQL para o service-developer**: `propose_agreement_adenda` / `renegotiate_agreement_pricing` (5 args) · `accept_agreement_adenda` (2 args) · `reject_agreement_adenda` (**2 args**, versão de 1 argumento removida) · `terminate_agreement(p_acordo_id, p_modo, p_justificativa, p_idempotency_key)` · `apply_due_agreement_terminations(p_acordo_id)`
- **Testes de auditoria**: cenários **G16 / G17 / G18** (G13 já é «pickup opcional») — **verdes** em `src/pages/MarketplaceAuditScenarios.test.jsx`.
- **API de serviço §22 para a UI**: `proposeAgreementAdenda(acordoId, { modo_preco, valor_ask_kz, n_passageiros? }, options)` · `respondAgreementAdenda(adendaId, accept, options)` · `terminateAgreement(acordoId, { modo, justificativa }, options)` · constantes `RESCISAO_MODOS` / `RESCISAO_JUSTIFICATIVAS`. Rescisão devolve `rescisao_aguarda_confirmacao` (consensual à espera da contraparte) e `rescisao_concluida`; offline devolve `{ offlineQueued: true, idempotency_key }`.

## Milestone anterior
- **Feature**: Marketplace Oferta / Procura
- **Status**: Phase 6 completa · Phase 7 **T32–T35 Done** (uncommitted) · T29+T30 uncommitted · Checkpoint 2026-09-05 ~11:20
- **Produto (2026-09-05):** Motorista flexível + propostas bidireccionais — Phase 7 **completa** (T32–T35)
- **Checkpoint:** [`.specs/features/marketplace-oferta-procura/CHECKPOINT.md`](../features/marketplace-oferta-procura/CHECKPOINT.md)

## Decisão de domínio (2026-09-04) — Grupo vivo
- Grupo = procura colectiva viva (não precisa estar «completo» para negociar)
- Quatro Ns: `N_actual` · `N_proposto` · `N_contrato` · `N_activos`
- Proposta = snapshot; entrada de membro não muta/invalida propostas abertas
- Preço nasce na oferta/proposta do motorista
- RPC `accept_proposal` alinhada a `N_proposto` (LIMIT primeiros membros)
- Waitlist: promoção = notif `waitlist_promoted` (RPC `promote_waitlist`), sem auto-aceitar
- **T31 Done:** `grupos.n_maximo`; pedidos `pendente`/`rejeitado`; descoberta pública; telefone = fallback
- **Ponto de Recolha Opcional (2026-09-06):** No fallback por telefone em `GrupoProcuraPanel`, telefone é obrigatório e ponto de recolha é opcional (`required={false}` em `AddressInput`). Submissão com recolha vazia persiste `null` em todas as camadas (`membros_grupo`, `GrupoService`, RPCs `accept_proposal`/`leave_grupo_membro` e BD).
- **T29 Done:** RPC `renegotiate_agreement_pricing` + UI adenda em `/acordos` (único caminho mutar preços / N_contrato)
- **T30 Done:** mapa N pontos preferenciais (MapLibre) em `PropostaReviewCard` antes do aceite
- **T32 Done:** RPC `accept_proposal` / `reject_proposal` + RLS — `created_by` não aceita/rejeita; migration `marketplace_t32_accept_reject_contraparte`
- **T33 Done:** propostas B (motorista→pax); inbox passageiro; deep links por `metadata.inbox`; trigger `notify_proposta_contraparte`; `findCompatibleProcuras` (fixa)
- **T34 Done:** oferta flexível sem OD; `OfertaService.resolveOdFields`; copy «Oferta flexível»; PublishRoute esconde OD quando flex
- **T35 Done:** matching dual — fixa geo+tempo; flex tempo/dias/capacidade sem OD/residência

## Decisão de produto (2026-09-05) — Motorista flexível + propostas bidireccionais

**Estado:** decisão imutável. **Phase 7 (T32–T35) implementada.**

**Checklist decisão ↔ docs:** OK. Residual: copy «zona» no hub passageiro se ainda existir (cosmético).

| Regra | MVP |
|---|---|
| Oferta **fixa** | OD + horário + dias + capacidade + preço → matching geo normal |
| Oferta **flexível** | Capacidade + disponibilidade + dias + janela + preço — **sem** OD obrigatório |
| Residência do motorista | **Não** define área de atuação; **não** exclui procuras por distância residência↔recolha |
| Zonas / polígonos / raio residencial | **Fora do MVP** |
| Flex ≠ «rota OD + flag» | Correcto: flexível **sem** rota fixa obrigatória; coluna BD `flexibilidade_rota` = flag legado |
| Propostas | **A** pax/grupo→motorista · **B** motorista→pax/grupo |
| Aceite | Só a **contraparte** (`created_by` não pode aceitar/rejeitar) |
| Cadeia | Procura → **M** propostas → 1 aceite → 1 acordo **1:N** (não Procura→Motorista 1:1) |
| `N_proposto` | Imutável se `N_actual` mudar |

## Regra de ouro
- Visual = v0 (One) + shadcn + UI Skills (+ Mobbin free-safe quando disponível)
- Negócio = spec/planos (1:N; quatro Ns; preço dual congelado; grupo vivo; flexível sem zona; propostas bidireccionais)

## Next Steps
1. ~~**T1b / T2b (TDD)**~~ **Done** — `proposeAgreementAdenda`, `respondAgreementAdenda`, `terminateAgreement`, `applyDueTerminationsBestEffort` e união `offlineQueue.rpc` implementados.
2. ~~**T1c / T2c**~~ **Done** — G16 / G17 / G18 verdes.
3. ~~**T4a / T4b**~~ **Done** — Stitch `8575463146283895778` (`a0ecae8f2e4b49188c3014bd4f4a2f39`, `f809c7c038f346f295c7dd1db36c5aab`); `TerminateAgreementModal` + CTAs bilaterais; 44/44.
4. **T5 (próximo):** re-review `code-reviewer` após `s22_rpc_grants_hardening` + `ui-qa` com `VERDICT` · T4c opcional (polish matching)
5. Commit T29 / T30 / T32 / T33 / T34 / T35 se o utilizador pedir (listas separadas no CHECKPOINT; sem lixo `.cline`/`.codex`)
6. Phase 7 **completa** — sem tasks residual MVP flex
7. **Não** implementar zonas/polígonos no MVP

## Key links
- Plan: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Spec · Design · Tasks · Checkpoint sob `.specs/features/marketplace-oferta-procura/`
- v0 T31: https://v0.app/chat/jo0mXnLQf42
- v0 T29: https://v0.app/chat/hT2KzrQr0Bt
- v0 T30: https://v0.app/chat/jIH3o5n1EM1
