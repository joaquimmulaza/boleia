# Boleia Certa Project Memory & State

## Current Active Milestone
- **Feature**: Marketplace Oferta / Procura
- **Status**: Phase 6 **completa** (T1–T31 Done) · T29+T30 **uncommitted** · Checkpoint 2026-09-05 ~09:15
- **Produto (docs, 2026-09-05):** decisão **Motorista flexível + propostas bidireccionais** — **só especificação**; código de produção **não** alterado nesta etapa
- **Checkpoint:** [`.specs/features/marketplace-oferta-procura/CHECKPOINT.md`](../features/marketplace-oferta-procura/CHECKPOINT.md)

## Decisão de domínio (2026-09-04) — Grupo vivo
- Grupo = procura colectiva viva (não precisa estar «completo» para negociar)
- Quatro Ns: `N_actual` · `N_proposto` · `N_contrato` · `N_activos`
- Proposta = snapshot; entrada de membro não muta/invalida propostas abertas
- Preço nasce na oferta/proposta do motorista
- RPC `accept_proposal` alinhada a `N_proposto` (LIMIT primeiros membros)
- Waitlist: promoção = notif `waitlist_promoted` (RPC `promote_waitlist`), sem auto-aceitar
- **T31 Done:** `grupos.n_maximo`; pedidos `pendente`/`rejeitado`; descoberta pública; telefone = fallback
- **T29 Done:** RPC `renegotiate_agreement_pricing` + UI adenda em `/acordos` (único caminho mutar preços / N_contrato)
- **T30 Done:** mapa N pontos preferenciais (MapLibre) em `PropostaReviewCard` antes do aceite

## Decisão de produto (2026-09-05) — Motorista flexível + propostas bidireccionais

**Estado:** documentado em `spec.md` / `design.md` / plano marketplace / `tasks.md` (T32+ Planned). **Sem implementação de código nesta etapa.**

| Regra | MVP |
|---|---|
| Oferta **fixa** | OD + horário + dias + capacidade + preço → matching geo normal |
| Oferta **flexível** | Capacidade + disponibilidade + dias + janela + preço — **sem** OD obrigatório |
| Residência do motorista | **Não** define área de atuação; **não** exclui procuras por distância residência↔recolha |
| Zonas / polígonos / raio residencial | **Fora do MVP** |
| Flex ≠ «rota OD + flag» | Correcto: flexível **sem** rota fixa obrigatória |
| Propostas | **A** pax/grupo→motorista · **B** motorista→pax/grupo |
| Aceite | Só a **contraparte** (`created_by` não pode aceitar/rejeitar) |
| Cadeia | Procura → **M** propostas → 1 aceite → 1 acordo **1:N** (não Procura→Motorista 1:1) |
| `N_proposto` | Imutável se `N_actual` mudar |

## Regra de ouro
- Visual = v0 (One) + shadcn + UI Skills (+ Mobbin free-safe quando disponível)
- Negócio = spec/planos (1:N; quatro Ns; preço dual congelado; grupo vivo; flexível sem zona; propostas bidireccionais)

## Next Steps
1. Commit T29 e/ou T30 se o utilizador pedir (listas separadas no CHECKPOINT; sem lixo `.cline`/`.codex`)
2. Implementar Phase 7 (docs T32+) **só quando o utilizador pedir**: P0 aceite-contraparte → P1 propostas B + notifs → P1 oferta flexível real + matching dual
3. **Não** implementar zonas/polígonos no MVP

## Key links
- Plan: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Spec · Design · Tasks · Checkpoint sob `.specs/features/marketplace-oferta-procura/`
- v0 T31: https://v0.app/chat/jo0mXnLQf42
- v0 T29: https://v0.app/chat/hT2KzrQr0Bt
- v0 T30: https://v0.app/chat/jIH3o5n1EM1
