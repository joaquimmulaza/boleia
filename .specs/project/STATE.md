# Boleia Certa Project Memory & State

## Current Active Milestone
- **Feature**: Marketplace Oferta / Procura
- **Status**: Execute · **T1–T28 + T31 Done** · **próximo T29 P2**
- **Checkpoint:** [`.specs/features/marketplace-oferta-procura/CHECKPOINT.md`](../features/marketplace-oferta-procura/CHECKPOINT.md)

## Decisão de domínio (2026-09-04) — Grupo vivo
- Grupo = procura colectiva viva (não precisa estar «completo» para negociar)
- Quatro Ns: `N_actual` · `N_proposto` · `N_contrato` · `N_activos`
- Proposta = snapshot; entrada de membro não muta/invalida propostas abertas
- Preço nasce na oferta/proposta do motorista
- RPC `accept_proposal` alinhada a `N_proposto` (LIMIT primeiros membros)
- Waitlist: promoção = notif `waitlist_promoted` (RPC `promote_waitlist`), sem auto-aceitar
- **T31 Done:** `grupos.n_maximo`; pedidos `pendente`/`rejeitado`; descoberta pública; telefone = fallback

## Regra de ouro
- Visual = v0 (One) + shadcn + UI Skills (+ Mobbin free-safe quando disponível)
- Negócio = spec/planos (1:N; quatro Ns; preço dual congelado; grupo vivo)

## Next Steps (Phase 6)
1. **T29 P2** adenda / `renegotiateAgreementPricing`
2. T30 P3 (mapa N pontos)

## Key links
- Plan: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Spec · Tasks · Checkpoint sob `.specs/features/marketplace-oferta-procura/`
- v0 T31: https://v0.app/chat/jo0mXnLQf42
