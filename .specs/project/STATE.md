# Boleia Certa Project Memory & State

## Current Active Milestone
- **Feature**: Marketplace Oferta / Procura
- **Status**: Execute · **T1–T28 Done** · **próximo T31**
- **Checkpoint:** [`.specs/features/marketplace-oferta-procura/CHECKPOINT.md`](../features/marketplace-oferta-procura/CHECKPOINT.md)

## Decisão de domínio (2026-09-04) — Grupo vivo
- Grupo = procura colectiva viva (não precisa estar «completo» para negociar)
- Quatro Ns: `N_actual` · `N_proposto` · `N_contrato` · `N_activos`
- Proposta = snapshot; entrada de membro não muta/invalida propostas abertas
- Preço nasce na oferta/proposta do motorista
- RPC `accept_proposal` alinhada a `N_proposto` (LIMIT primeiros membros)
- Waitlist: promoção = notif `waitlist_promoted` (RPC `promote_waitlist`), sem auto-aceitar
- Pendente T31: `n_maximo` + descoberta pública / pedido de entrada

## Regra de ouro
- Visual = v0 (One) + shadcn + UI Skills (+ Mobbin free-safe quando disponível)
- Negócio = spec/planos (1:N; quatro Ns; preço dual congelado; grupo vivo)

## Next Steps (Phase 6)
1. **T31** `n_maximo` + grupo público / pedir entrada
2. T29 P2 (adenda); T30 P3 (mapa N pontos)

## Key links
- Plan: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Spec · Tasks · Checkpoint sob `.specs/features/marketplace-oferta-procura/`
