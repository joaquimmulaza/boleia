# Boleia Certa Project Memory & State

## Current Active Milestone
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
1. Commit T29 / T30 / T32 / T33 / T34 / T35 se o utilizador pedir (listas separadas no CHECKPOINT; sem lixo `.cline`/`.codex`)
2. Phase 7 **completa** — sem tasks residual MVP flex
3. **Não** implementar zonas/polígonos no MVP

## Key links
- Plan: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Spec · Design · Tasks · Checkpoint sob `.specs/features/marketplace-oferta-procura/`
- v0 T31: https://v0.app/chat/jo0mXnLQf42
- v0 T29: https://v0.app/chat/hT2KzrQr0Bt
- v0 T30: https://v0.app/chat/jIH3o5n1EM1
