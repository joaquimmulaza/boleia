# Marketplace Oferta / Procura — Tasks

**Design**: `.specs/features/marketplace-oferta-procura/design.md`  
**Spec / Context**: `spec.md`, `context.md`  
**UI visual**: `.specs/features/marketplace-oferta-procura/v0-reference/` (aprovado)  
**SoT negócio**: planos marketplace + mapa impacto + `spec.md` / `context.md` / `design.md` — **prevalecem sobre o protótipo v0** se houver conflito  
**Status**: Phase 1–5 Done · Phase 6: **T22–T24 Done** · **T25←** — completar bifurcação 1:N
**Checkpoint:** [CHECKPOINT.md](./CHECKPOINT.md)

---

## Execution Plan

### Phase 1 — Fundação lógica (sequencial)

```
T1 → T2 → T3
```

### Phase 2 — Schema BD (MCP Supabase, sequencial)

```
T4 → T5 → T6 → T7
```

### Phase 3 — Serviços (paralelo após T7; TDD)

```
     ┌→ T8 ─┐
T7 ──┼→ T9 ─┼──→ T13
     ├→ T10─┤
     ├→ T11─┤
     └→ T12─┘
```

### Phase 4 — UI (visual v0; lógica da spec)

```
T14 → T15 → T16 → T17 → T18 → T19
```

### Phase 5 — Docs / limpeza

```
T20 → T21
```

### Phase 6 — Bifurcação 1:N (produto; após T21)

```
T22 → T23 → T24 → T25
T26, T27, T28 (após T24)
T29 (P2), T30 (P3)
```

**Status global:** Phase 1–5 **Done**. Phase 6: T22–T24 **Done** · **T25← AQUI**.
---

## Tools por fase

| Fase | Tools |
|------|--------|
| T1–T3, T8–T13 | Vitest, ficheiros `src/` — **sem** inventar UI |
| T4–T7 | **Supabase MCP** (`apply_migration`, `execute_sql`) — exclusivo para DDL |
| T14–T19 | Visual = `v0-reference` + Penpot quando ligado; negócio = spec/context/design/planos |
| Skills | TDD Akita; `baseline-ui` na UI; **não** TypeScript / toast / dual-write |

---

## Phase 1: Fundação lógica

### T1: `resolveAgreementPricing` + testes

- **ID:** MKT-04  
- **Do:** Criar `src/utils/resolveAgreementPricing.js` + `resolveAgreementPricing.test.js` (TDD)  
- **Rules:** POR_PASSAGEIRO exacto; TOTAL_ACORDO resto (`base`/`resto`, ordem inserção); `sum(quotas)===T`; rejeitar N&lt;1  
- **Verify:** Vitest verde; casos 120000/4, 100000/3, 100001/3, N=1  
- **Status:** Done

### T2: `matchingConfig` + haversine `geo.js`

- **ID:** MKT-09  
- **Do:** `src/utils/matchingConfig.js` (15 min, 2500 m OD) + `src/utils/geo.js` + testes  
- **Verify:** haversine conhecido; defaults exportados  
- **Deps:** —  
- **Status:** Done

### T3: `isTimeCompatible` / filtros matching puros

- **ID:** MKT-09, MKT-17  
- **Do:** Funções puras matching (tempo ±tol; raio OD; `N_candidato <= vagas`) + testes — **sem** routing  
- **Verify:** 20 min fora; 10 min dentro; capacidade vs waitlist  
- **Deps:** T2  
- **Status:** Done  
- **Ficheiros:** `src/utils/matchingFilters.js` + `matchingFilters.test.js` (`isTimeCompatible`, `isOriginWithinRadius`, `isDestinationWithinRadius`, `canAcceptDirectly`, `evaluateMatch` → `direct`|`waitlist`|`incompatible`)

---

## Phase 2: Schema (reconstrução limpa)

### T4: DROP domínio legado (`routes`, RPCs seats, triggers `/4`)

- **ID:** MKT-10  
- **Do:** Migração MCP — preservar `perfis`/push/notif/VAPID/`handle_new_user`  
- **Verify:** `routes` inexistente; signup/perfis intactos  
- **Deps:** T1–T3 opcional (podem ir em paralelo com prep)  
- **Status:** Done  
- **Migration:** `marketplace_t4_drop_legacy_domain`

### T5: ALTER `veiculos` (`capacidade_total`, `vagas_passageiros`)

- **ID:** MKT-01  
- **Verify:** UNIQUE `id_motorista`; sem ambiguidade `lugares_disponiveis`  
- **Deps:** T4  
- **Status:** Done  
- **Migration:** `marketplace_t5_alter_veiculos_capacidade`

### T6: CREATE ofertas/procuras/grupos/propostas/lista_espera/acordos+acordos_passageiros + RLS

- **ID:** MKT-01,02,08,11,18  
- **Do:** Schema conforme design; CHECK `vagas_disponiveis >= 0`; sem `passenger_id` no cabeçalho acordo  
- **Deps:** T5  
- **Status:** Done  
- **Migration:** `marketplace_t6_create_oferta_procura_schema`

### T7: RPC `accept_proposal` + trigger faltas + notif

- **ID:** MKT-03,05,06,07,12  
- **Do:** Lock oferta; N ≤ vagas; pricing/resto; cancelar propostas irmãs; faltas = `base/dias_uteis`; push intacto  
- **Verify:** SQL/teste regressão saída não altera quotas; zero `/ 4`  
- **Deps:** T6, T1  
- **Status:** Done  
- **Migrations:** `marketplace_t7_accept_proposal_and_triggers`, `t7b_fix_acordo_notifications_timing`, `t7c_revoke_anon_grants`

---

## Phase 3: Serviços

### T8: OfertaService (CRUD)

- **ID:** MKT-01  
- **Deps:** T6  
- **Status:** Done  
- **Ficheiros:** `src/services/OfertaService.js` + `.test.js`

### T9: ProcuraService / GrupoService (`N_candidato`)

- **ID:** MKT-02, MKT-17  
- **Deps:** T6  
- **Status:** Done  
- **Ficheiros:** `ProcuraService.js`, `GrupoService.js`, `ProcuraService.test.js`

### T10: PropostaService (1:M)

- **ID:** MKT-18  
- **Deps:** T6  
- **Status:** Done  
- **Ficheiros:** `PropostaService.js` + `.test.js`

### T11: AgreementService (`createAgreementFromProposal`, `leavePassenger`)

- **ID:** MKT-03,05,17  
- **Do:** Chamar RPC; assert preços intactos na saída  
- **Deps:** T7  
- **Status:** Done  
- **Ficheiros:** `AgreementService.js` + `.test.js` (novo; legado `AgreementsService` permanece até T21)

### T12: MatchingService + WaitlistService

- **ID:** MKT-08,09  
- **Deps:** T3, T6  
- **Status:** Done  
- **Ficheiros:** `MatchingService.js`, `WaitlistService.js`, `MatchingService.test.js`

### T13: AbsenceService adaptado (sem `/4`)

- **ID:** MKT-07  
- **Deps:** T7  
- **Status:** Done  
- **Ficheiros:** `AbsenceService.js` (+ `viagem`/`passenger_id`); assert sem `/4`

---

## Phase 4: UI (visual v0 · lógica spec)

> **Regra:** Layout/copy do `v0-reference`. Estados, Ns, preços, waitlist e capacidade **sempre** da spec/context/design/planos. Nunca expor jargon (`N_candidato`, `modo_preco`, etc.) na UI.

### T14: Adaptar VehicleSetup (`capacidade_total`)

- **Path:** `/veiculo`  
- **Deps:** T5, T8  
- **Status:** Done

### T15: Página Publicar / editar oferta (selector modo preço)

- **Path:** `/publicar-trajeto` — visual v0 «Publicar oferta»  
- **Deps:** T8  
- **Status:** Done

### T16: Hub motorista + rever/aceitar proposta

- **Path:** `/motorista` — v0 ofertas + rever proposta  
- **Deps:** T8, T10, T11  
- **Status:** Done

### T17: Hub passageiro + matches + waitlist

- **Path:** `/passageiro` — v0 procura/matches/espera  
- **Deps:** T9, T12  
- **Status:** Done

### T18: MyAgreements + detalhe 1:N

- **Path:** `/acordos` — v0 acordos/detalhe  
- **Deps:** T11  
- **Status:** Done

### T19: AbsenceTracker adaptado + App.jsx / notificationRouter

- **ID:** MKT-14  
- **Deps:** T13, T18  
- **Status:** Done  
- **Notas:** `notificationRouter` com `proposal_received` / `waitlist_promoted`; Profile também usa `capacidade_total`

---

## Phase 5: Docs

### T20: Actualizar `AGENTS.md` (oferta/procura SoT; remover `routes`)

- **ID:** MKT-16  
- **Deps:** T7+  
- **Status:** Done  
- **Notas:** Também `.cursorrules` alinhado ao domínio marketplace

### T21: Remover serviços/páginas legado + testes associados

- **Do:** `RouteService`, `AgreementsService`/`requestSeat`, `AgreementLifecycle.test`, componentes `Acordo*` acoplados a `routes`  
- **Deps:** T15–T19  
- **Status:** Done

---

## Phase 6: Completar bifurcação 1:N (produto ainda N=1)

> Diagnóstico (2026-09-04): schema/RPC ~80–90%; serviços ~70%; UI ~40% (só prova N=1).  
> Plano: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`  
> Checkpoint: `.specs/features/marketplace-oferta-procura/CHECKPOINT.md`

### T22: UI Grupo na procura (criar / membros / sync N_candidato)

- **ID:** MKT-02, MKT-17
- **Do:** Em `/passageiro` — criar grupo ligado à procura; adicionar membros (mín. owner + convidados); pontos pickup opcionais; chamar `GrupoService` (`createGrupo`, `addMembro`, `syncNCandidato`); UI copy humana (nunca `N_candidato`)
- **Deps:** T9, T17
- **Status:** Done
- **Verify:** Procura com 3 membros → `n_candidato === 3` (`N_actual`); propostas abertas **mantêm** snapshot ao mudar membros (não invalidar automaticamente)
- **TDD:** testes página/serviço grupo antes da UI
- **Ficheiros:** `GrupoProcuraPanel.jsx`, `GrupoService` (`getGrupoByProcura`, `listMembrosGrupo`), `ProfileService.findPassageiroByTelefone`, integrado em `PassengerDashboard`

### T23: Proposta com `grupo_id` + N_proposto (= N_actual)

- **ID:** MKT-03, MKT-18, MKT-17  
- **Do:** `createProposta` passa `grupo_id` quando existe; `n_passageiros_propostos = N_actual` (snapshot); **não** bloquear por grupo «incompleto» vs `n_maximo`  
- **Deps:** T22, T10  
- **Status:** Done (revisto 2026-09-04 — grupo vivo)  
- **Verify:** Proposta com `grupo_id` e `N_proposto = N_actual` (ex. 2/4 → N=2); entrada posterior de membro **não** muta a proposta  
- **Notas:** Serviço exige `grupo_id` só se N>1 (entidade grupo); RPC `accept_proposal` inclui primeiros `N_proposto` membros; sync N_actual **não** invalida propostas abertas

### T24: Hub motorista — rever proposta multi-passageiro

- **ID:** MKT-03
- **Do:** Em «Rever propostas»: listar passageiros/pontos do grupo; preço resolvido (Por passageiro / Total do acordo); Aceitar chama RPC (já atómica)
- **Deps:** T23, T16
- **Status:** Done
- **Verify:** Aceitar N=3 cria 3 `acordos_passageiros`; oferta `vagas_disponiveis` −3; estado `parcial`/`cheia`
- **Nota:** UI+enrich TDD (`propostaReview`, `PropostaReviewCard`, loading sem stale). Efeito RPC N=3 deferido a T25 E2E.

### T25: E2E TOTAL_ACORDO N=3/4 + saída sem recalcular quotas

- **ID:** MKT-04, MKT-05, MKT-06  
- **Do:** Testes (Vitest + smoke browser se possível): ask 120000 TOTAL_ACORDO N=3 → 40000; 100000/3 resto; `leavePassenger` não altera `valor_mensal_*` nem quotas restantes  
- **Deps:** T24, T11  
- **Status:** Pending  
- **Verify:** Asserções verdes; grep sem recálculo por COUNT(activos)

### T26: Waitlist — promoção ao libertar vaga

- **ID:** MKT-08, MKT-12  
- **Do:** Ao `leavePassenger` / cancelamento: notificar 1º da `lista_espera` (`waitlist_promoted`); serviço `promoteWaitlist` ou trigger/RPC; UI passageiro mostra estado na lista  
- **Deps:** T12, T17  
- **Status:** Pending  
- **Verify:** Sair pax → notif waitlist; sem auto-aceitar

### T27: Publicar oferta — dias_semana + flexibilidade (mínimo)

- **ID:** MKT-01  
- **Do:** UI `/publicar-trajeto`: selector Seg–Sex (default) + toggle «Rota flexível» → `flexibilidade_rota` / `dias_semana` (já no `OfertaService`)  
- **Deps:** T15, T8  
- **Status:** Pending  
- **Verify:** Oferta gravada com flags; copy humana

### T28: Detalhe acordo 1:N (lista passageiros + preço congelado)

- **ID:** MKT-03  
- **Do:** `/acordos` detalhe alinhado v0: lista pax, quota, CTA sair / registar falta; badge «Preço combinado / congelado»  
- **Deps:** T18, T24  
- **Status:** Pending  
- **Verify:** Motorista vê N linhas; passageiro vê a sua quota

### T29 (P2): Adenda / renegotiateAgreementPricing

- **ID:** MKT-13  
- **Status:** Pending (fora da wave imediata)  
- **Nota:** Só mutação de preços / N_contrato via adenda explícita

### T30 (P3): Mapa N pontos preferenciais

- **ID:** MKT-15  
- **Status:** Pending (placeholder OK até Penpot)  
- **Nota:** Antes do motorista aceitar — pontos dos membros cobertos pelo `N_proposto`

### T31: Grupo vivo — `n_maximo` + descoberta pública / pedido de entrada

- **ID:** MKT-02, MKT-17  
- **Do:** Coluna `n_maximo` em `grupos` (ou procura); UI capacidade pretendida; listagem pública de grupos + fluxo pedir entrada / aprovação (substituir convite só por telefone)  
- **Deps:** T22  
- **Status:** Pending  
- **Verify:** Grupo 2/4 visível a outros passageiros; pedido de entrada aumenta `N_actual`; propostas abertas inalteradas

---

## Parallelism

| Wave | Tasks |
|------|-------|
| A | T1, T2 (paralelo) |
| B | T3 |
| C | T4→T7 (schema) — pode começar após A se necessário |
| D | T8–T12 paralelo; T11/T13 após T7 |
| E | T14–T19 sequencial por ecrã |
| F | T20–T21 |
| G | T22 → T23 → T24 → T25 (sequencial; núcleo bifurcação) |
| H | T26, T27, T28 (após T24; paralelizáveis entre si) |
| I | T29 P2; T30 P3 |

---

## Requirement Traceability

| ID | Tasks |
|----|-------|
| MKT-01 | T5, T6, T8, T15, T27 |
| MKT-02 | T6, T9, T17, T22 |
| MKT-03 | T7, T11, T16, T23, T24, T28 |
| MKT-04 | T1, T7, T25 |
| MKT-05 | T7, T11, T25 |
| MKT-06 | T7, T25 |
| MKT-07 | T7, T13, T19 |
| MKT-08 | T6, T12, T17, T26 |
| MKT-09 | T2, T3, T12, T17 |
| MKT-10 | T4 |
| MKT-11 | T6 |
| MKT-12 | T7, T19, T26 |
| MKT-13 | T29 (P2) |
| MKT-14 | T19 |
| MKT-15 | T30 (P3) |
| MKT-16 | T20 |
| MKT-17 | T3, T9, T11, T22 |
| MKT-18 | T6, T10, T16, T23 |
