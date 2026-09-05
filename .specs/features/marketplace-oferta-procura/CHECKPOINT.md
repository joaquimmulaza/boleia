# Checkpoint — Marketplace Oferta / Procura

**Data:** 2026-09-05 (~12:45 UTC+1)  
**Branch:** `main` (T29 + T30 + T32–**T35 uncommitted**; T31 on `origin/main`; **P0 hardening** + **wave paralela** uncommitted)  
**Chat:** Phase 7 Done + P0 hardening + **wave paralela GREEN** (ver `WAVE_PARALLEL_REPORT.md`).  
**Usar este ficheiro** para retomar sem perder contexto.

### Wave paralelismo (2026-09-05) ← **GREEN · uncommitted**

- Agentes: Matching, Group (+ follow-up `leave_grupo_membro`), Proposal, Agreement, Flex UX, UI, Test observer.
- Suite: **413 passed / 0 failed** (60 ficheiros). Baseline mid-wave era 378/19 failed.
- P0: `leave_passenger` + `leave_grupo_membro`; sem UPDATE client em propostas/acordos/acordos_passageiros/lista_espera; join sem auto-aprovação.
- Relatório: `.specs/features/marketplace-oferta-procura/WAVE_PARALLEL_REPORT.md`
- Gaps cobertura (não bloqueantes): `AUDIT_GAPS_WAVE.md` G1–G12.
- **Commit só se o utilizador pedir.**

**Commits relevantes:**
- `178cd50` — T24 hub motorista multi-pax  
- `dc52862` — **T25–T28** (E2E quotas, waitlist, oferta dias, detalhe acordo 1:N)  
- `8a0111e` — **T31** n_maximo + grupo público / pedir entrada (**pushed**)  
- `443d149` — sync CHECKPOINT pós-push T31  
- *(uncommitted)* **T29** adenda / `renegotiateAgreementPricing`  
- *(uncommitted)* **T30** mapa N pontos preferenciais (MapLibre)  
- *(uncommitted)* **T32** aceite/rejeição só pela contraparte (`reject_proposal` + gate `created_by`)  
- *(uncommitted)* **T33** propostas B + inbox passageiro + deep links + trigger notif  
- *(uncommitted)* **T34** oferta flexível sem OD + copy «Oferta flexível»  
- *(uncommitted)* **T35** matching dual (flex sem OD/residência)
- *(uncommitted)* **P0 hardening** `leave_passenger` RPC; DROP UPDATE client em propostas/acordos/acordos_passageiros/lista_espera; RLS membros owner-only (+ self só reabrir `pendente`); `aprovarEntrada`/`rejeitarEntrada` exigem organizador

---

## Prompt para colar no chat novo

```
Continua marketplace a partir de:
.specs/features/marketplace-oferta-procura/CHECKPOINT.md

Phase 6 T22–T31 Done. Phase 7 T32–T35 Done UNCOMMITTED — commit só se eu pedir
(ficheiros listados no CHECKPOINT; NÃO misturar lixo .cline/.codex/.cursor).

Decisão produto 2026-09-05: motorista flexível SEM zona/OD; propostas A/B;
aceite só contraparte. Phase 7 completa.

Ler CHECKPOINT + AGENTS.md.

Regras: AGENTS.md + .cursorrules; TDD; JS+JSDoc; sem TS/toast;
DDL só via Supabase MCP; copy UI humana; invariantes grupo/waitlist/leave/adenda.

Git: push só se eu pedir.
```

---

## Verdade dura (não renegociar)

Cardinalidade **1 motorista : N passageiros** no acordo; procura/grupo → **M** propostas; aceitar 1 → **1 acordo**.  
Preço dual `POR_PASSAGEIRO` | `TOTAL_ACORDO`; lotação do veículo **nunca** divide preço.  
Quotas **congeladas** na aceitação; saída de pax **não** recalcula mês corrente.  
Capacidade global = soma `N_activos` nos acordos da oferta.  
Matching MVP: oferta **fixa** ±15 min + raio OD 2500 m; oferta **flexível** tempo/dias/capacidade **sem** OD/zona (**T34 publish + T35 matching Done**); waitlist se N > vagas (sem auto-aceitar).  
Promoção waitlist = **notificação** (`waitlist_promoted`) + estado `notificada` — **nunca** auto-aceitar.  
**Adenda (T29 Done):** único caminho para mutar preços / `N_contrato` — copy «mês seguinte»; MVP aplica valores de imediato via RPC.  
**Mapa (T30 Done):** pins 1-based dos pontos preferenciais do snapshot antes do aceite (MapLibre + OSM).  
**Produto (2026-09-05):** motorista flexível sem zona/OD; propostas A/B; aceite só contraparte; cadeia Procura→M propostas→1 acordo 1:N. **Phase 7 T32–T35 Done.**

### Grupo = procura colectiva viva

| Errado | Certo |
|---|---|
| Grupo incompleto ⇒ não pode propor/receber | Incompleto ⇒ aberto a membros **e** negociável com `N_proposto = N_actual` |
| Preço no grupo | Preço na **oferta/proposta** do motorista |
| Entrada só por telefone | Público/descobrível + pedido de entrada (**T31 Done**); telefone = fallback |
| Entrar membro invalida propostas | Propostas **mantêm** snapshot; novo N ⇒ **nova** proposta |

### Quatro Ns

| Símbolo | BD / campo | Uso |
|---|---|---|
| `N_actual` | `procuras.n_candidato` | Membros activos agora; matching; UI «Grupo · 2 de 4» |
| `N_proposto` | `propostas.n_passageiros_propostos` | Snapshot da negociação; imutável na versão |
| `N_contrato` | `acordos.n_passageiros_contrato` | Congelado no aceite; mutável **só** via adenda T29 |
| `N_activos` | COUNT pax activos no acordo | Só vagas/UI lotação — nunca preço |

Alias legado: `N_candidato` = `N_actual`. Coluna BD: `n_candidato`.

---

## Progresso

| Fase | Tasks | Status |
|------|-------|--------|
| 1 Utils | T1–T3 | **Done** |
| 2 Schema MCP | T4–T7 | **Done** |
| 3 Serviços | T8–T13 | **Done** |
| 4 UI | T14–T19 | **Done** |
| 5 Docs | T20–T21 | **Done** |
| 6 Bifurcação | **T22–T31 Done** (incl. T29 + T30) | **Phase 6 completa** |
| 7 Flexível + propostas bi | **T32–T35 Done** | **Phase 7 completa** (uncommitted) |

### Maturidade (~)

| Camada | % | Nota |
|---|---|---|
| Schema + RPC | ~100% | `accept_proposal` + `reject_proposal` + trigger notif proposta + `promote_waitlist` + `renegotiate_agreement_pricing` + `n_maximo`; OD ofertas já nullable |
| Serviços | ~100% MVP | Matching dual T35 + adenda + leave + waitlist + grupo + reject + `createOferta` flex |
| UI produto | ~100% MVP | Inbox B + PublishRoute OD condicional + descoberta flex via hub |
| E2E N>1 | ~90% | T25 + T29 testes adenda |

---

## Feito (não reinventar) — T22–T35 + T29 + T30 + P0 hardening

### P0 hardening (pós-auditoria) ← **Done (uncommitted)**

**MCP:** `marketplace_p0_hardening_leave_rls`

- RPC `leave_passenger` — atómica: `saiu` + recount `vagas_disponiveis` + `promote_waitlist` best-effort; sem mutar preços/quotas
- DROP UPDATE client: `propostas`, `acordos`, `acordos_passageiros`, `lista_espera` (só SECURITY DEFINER)
- `membros_grupo`: UPDATE owner **ou** self só para reabrir como `pendente` (não `activo`)
- JS: `AgreementService.leavePassenger` → RPC; `GrupoService` aprovar/rejeitar exige organizador
- RPC `leave_grupo_membro` — self `activo`→`saiu` + sync `n_candidato`; bloqueia único activo; sem tocar propostas; `GrupoService.sairDoGrupo` → RPC

**Testes:** AgreementService + GrupoService + AgreementsE2E — 34 verdes no âmbito

### T35 — Matching dual (fixa vs flexível) ← **Done (uncommitted)**

**Gates:** TDD → implementer → code-review **APPROVE**. Sem UI nova (hub T33 já lista «Procuras compatíveis»). Sem DDL / zonas.

**Lógica:**
- `evaluateMatch`: fixa = tempo + dias + geo OD; flexível = tempo + dias + capacidade (**sem** OD/residência)
- `isDaysCompatible`: intersecção; se um lado vazio → compatível (procura MVP sem `dias_semana`); normaliza strings JSON/BD
- Fixa com OD incompleto → `incompatible` (evita falso positivo via `Number(null)=0`)
- Flex com coords residuais/legado **ignora** OD (sem falso negativo por residência)
- `findCompatibleProcuras`: flex sem OD deixa de devolver `[]`; consulta procuras activas; fixa sem OD → buckets vazios
- `findCompatibleOfertas`: passa `flexibilidade_rota` / `dias_semana` (passageiro vê flex por tempo/capacidade)
- Capacidade: `N_actual` (`n_candidato`) vs `vagas` → `direct` | `waitlist` (nunca auto-aceitar)

**Hardening (matching engine, pós-T35):** testes de falsos +/− (fixa/flex/dias/capacidade/bidireccional) + integração real no `MatchingService` (sem mock cego de `evaluateMatch`).

**Testes:** 41 verdes (`matchingFilters` + `MatchingService` + `matchingConfig`)

**Ficheiros T35 / matching (para commit quando pedido):**
```
src/utils/matchingFilters.js
src/utils/matchingFilters.test.js
src/services/MatchingService.js
src/services/MatchingService.test.js
.agent/subagents/boleia-marketplace-matching.md
.specs/features/marketplace-oferta-procura/{CHECKPOINT,tasks,spec}.md
.specs/project/STATE.md
AGENTS.md
```

### T34 — Oferta flexível real (sem OD) ← **Done (uncommitted)**

**Gates:** design (design.md flow + copy; Mobbin degradado plano free; reuso PublishRoute) → TDD → implementer → code-review **APPROVE**. Sem DDL (colunas OD já nullable).

**Lógica:**
- `OfertaService.createOferta` / `resolveOdFields`: fixa exige OD+coords; flexível grava OD `null`
- Sem zonas / raio residencial

**UI:**
- `PublishRoute` — copy «Oferta flexível» (não «Rota flexível»); OD escondido quando flex; limpa OD ao activar flex
- Fixa continua a exigir origem/destino

**Testes:** 15 verdes (`OfertaService` + `PublishRoute`)

**Ficheiros T34 (para commit quando pedido):**
```
src/services/OfertaService.js
src/services/OfertaService.test.js
src/pages/PublishRoute.jsx
src/pages/PublishRoute.test.jsx
.specs/features/marketplace-oferta-procura/{CHECKPOINT,tasks}.md
.specs/project/STATE.md
AGENTS.md
```

### T33 — Propostas B + inbox passageiro + deep links ← **Done (uncommitted)**

**Gates:** TDD → implementer → code-review **APPROVE**. Design: reuso `PropostaReviewCard` + UI Skills baseline; Mobbin degradado (plano free); v0 chat `pbWKgpZagf5` (sem ficheiros gerados — adaptado padrão T24).

**MCP:** `marketplace_t33_proposta_notify_contraparte` — trigger `on_proposta_created_notify` → notif `proposal_received` com `inbox: passageiro|motorista`.

**Lógica:**
- `notificationRouter.proposal_received` → `/passageiro` ou `/motorista` via `metadata.inbox`
- `findCompatibleProcuras` (oferta fixa geo+tempo; flex → T35)
- `filterPropostasParaInbox` — só abertas com `created_by ≠ eu`

**UI:**
- `DriverDashboard` — «Procuras compatíveis» + Propor (B); inbox «Ver propostas» só A
- `PassengerDashboard` — «Propostas recebidas» + Aceitar/Recusar (B)

**Testes:** 32 verdes (router + inbox filter + matching + hubs)

**Ficheiros T33 (para commit quando pedido):**
```
src/utils/notificationRouter.js
src/utils/notificationRouter.test.js
src/utils/propostaInbox.js
src/utils/propostaInbox.test.js
src/services/MatchingService.js
src/services/MatchingService.test.js
src/pages/DriverDashboard.jsx
src/pages/DriverDashboard.test.jsx
src/pages/PassengerDashboard.jsx
src/pages/PassengerDashboard.test.jsx
.specs/features/marketplace-oferta-procura/{CHECKPOINT,tasks}.md
.specs/project/STATE.md
AGENTS.md
```

### T32 — Aceite/rejeição só pela contraparte ← **Done (uncommitted)**

**Gates:** TDD → implementer → code-review **APPROVE**. Sem UI nova.

**RPC / RLS (MCP `marketplace_t32_accept_reject_contraparte`):**
- `accept_proposal`: se `auth.uid() = created_by` → erro PT
- Nova `reject_proposal` (SECURITY DEFINER): mesmos gates + permissão driver/owner
- RLS `propostas_update_envolvidos`: UPDATE só se `auth.uid() IS DISTINCT FROM created_by`

**Serviços:**
- `createAgreementFromProposal` — propaga mensagem RPC
- `rejectProposta` — chama `reject_proposal` (já não UPDATE directo)

**Testes:** 27 verdes (`AgreementService` + `PropostaService`)

**Ficheiros T32 (para commit quando pedido):**
```
src/services/AgreementService.js
src/services/AgreementService.test.js
src/services/PropostaService.js
src/services/PropostaService.test.js
.specs/features/marketplace-oferta-procura/{CHECKPOINT,tasks}.md
.specs/project/STATE.md
```

### T30 — Mapa N pontos preferenciais ← **Done (uncommitted)**

**Gates:** design APPROVE · UI QA APPROVE (ciclo 2) · code-review APPROVE (ciclo 2) · **30** testes Vitest verdes.

**UI / util:**
- `buildPropostaReview` expõe `pickup_*` + `dropoff_*` coords
- `buildPreferentialMapPoints` → pontos com `memberIndex` 1-based
- `PreferentialPointsMap` — MapLibre dinâmico + OSM; pins numerados; empty/partial/erro/boot skeleton; deps por `pointsKey` (sem remount por referência)
- `PropostaReviewCard` — mapa após título; omitido se `membros=[]`; nota «X de Y com localização»

**Design:** v0 https://v0.app/chat/jIH3o5n1EM1 · `design.md` § T30 · Mobbin degradado · SoT v0/shadcn (não Penpot)

**Ficheiros T30 (para commit quando pedido):**
```
src/utils/propostaReview.js
src/utils/propostaReview.test.js
src/components/PreferentialPointsMap.jsx
src/components/PreferentialPointsMap.test.jsx
src/components/PropostaReviewCard.jsx
src/components/PropostaReviewCard.test.jsx
.specs/features/marketplace-oferta-procura/{CHECKPOINT,design,tasks}.md
.specs/project/STATE.md
AGENTS.md
```
(+ `spec.md` se MKT-15 marcado Done no mesmo commit)

### T29 — Adenda / `renegotiateAgreementPricing` ← **Done (uncommitted)**

**Gates:** design · UI QA · code-review APPROVE.  
**RPC:** `renegotiate_agreement_pricing` · **UI:** `MyAgreements` «Renegociar preço».  
**Ficheiros:** ver lista anterior no CHECKPOINT T29 (AgreementService, MyAgreements, ConfirmationModal, specs…).

### T31 — `n_maximo` + grupo público ← **Done (`8a0111e`, pushed)**

### T22–T28 (resumo)

| Task | Essência | Commit |
|------|----------|--------|
| T22 | UI criar grupo + membros | pré-178cd50 |
| T23 | Proposta grupo vivo; sem bloquear incompleto | pré-178cd50 |
| T24 | Hub motorista `PropostaReviewCard` | `178cd50` |
| T25 | E2E quotas + leave imutável | `dc52862` |
| T26 | `promote_waitlist` (só notif) | `dc52862` |
| T27 | Oferta dias + flag flex (débito T34: **corrigido**) | `dc52862` + T34 |
| T28 | Detalhe acordo 1:N | `dc52862` |

---

## O que falta

```
Phase 6 — COMPLETA. Phase 7 — COMPLETA (T32–T35 Done, uncommitted).
Commits T29/T30/T32/T33/T34/T35 só sob pedido (listas separadas).
Fora do MVP: zonas/polígonos/raio residencial.
```

---

## Stack / serviços canónicos

**BD** (`boleia` / `fdclrbcgytnuqcrpsevw`):  
`ofertas_capacidade`, `procuras`, `grupos` (+`n_maximo`), `membros_grupo` (+pickup/dropoff coords), `propostas`, `lista_espera`, `acordos`, `acordos_passageiros`, `faltas`, `veiculos`.  
RPCs: `accept_proposal`, `reject_proposal`, `promote_waitlist`, `renegotiate_agreement_pricing`.  
Triggers: `on_proposta_created_notify` → `proposal_received` (inbox contraparte).

**Serviços:** `OfertaService` (flex sem OD), `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService` (+ `renegotiateAgreementPricing`), `MatchingService` (+ `findCompatibleProcuras` / `findCompatibleOfertas` dual fixa/flex), `WaitlistService`, `AbsenceService`, `LocationService` (Photon), `ProfileService.findPassageiroByTelefone`.  
**Mapa:** `maplibre-gl` via `PreferentialPointsMap` (hub motorista).

**Removido (não recriar):** `RouteService`, `requestSeat`, cards `Acordo*` com `routes`, Google Maps.

---

## Contas QA

- Motorista: `qa.motorista.mkt+20260904@boleiacerta.test` / `TesteQA123!`
- Passageiro: `qa.passageiro.mkt+20260904@boleiacerta.test` / `TesteQA123!`

---

## Regras de execução

1. TDD: teste → falha → código → verde  
2. Só `.js` / `.jsx` + JSDoc  
3. DDL **só** Supabase MCP  
4. Copy humana; nunca jargon de Ns / `POR_PASSAGEIRO`  
5. Design SoT: v0/shadcn/UI Skills (Penpot descontinuado)  
6. Commit / push **só** se o utilizador pedir  
7. Working tree: T29 + T30 + T32–T35 uncommitted — **não** misturar `.cline`/`.codex`/`.cursor` lixo  
8. Spec/planos prevalecem sobre v0 se houver conflito  

---

## Handoff git (snapshot)

```
(uncommitted) wave paralela + leave_grupo_membro + WAVE_PARALLEL_REPORT (GREEN 413)
(uncommitted) feat(marketplace): T35 matching dual fixa/flex sem OD
(uncommitted) feat(marketplace): T34 oferta flexível sem OD
(uncommitted) feat(marketplace): T33 propostas B + inbox + deep links
(uncommitted) feat(marketplace): T32 aceite/rejeição só pela contraparte
(uncommitted) feat(marketplace): T30 mapa N pontos preferenciais (MapLibre)
(uncommitted) feat(marketplace): T29 adenda renegotiateAgreementPricing
443d149 chore(marketplace): sincronizar CHECKPOINT após push T31
8a0111e feat(marketplace): T31 n_maximo + grupo público / pedir entrada
```

Mensagens sugeridas (quando pedires — **commits separados** preferível):

```
feat(marketplace): T35 matching dual fixa/flex sem OD
```

```
feat(marketplace): T34 oferta flexível sem OD
```

```
feat(marketplace): T33 propostas B + inbox + deep links
```

```
feat(marketplace): T32 aceite/rejeição só pela contraparte
```

```
feat(marketplace): T30 mapa N pontos preferenciais
```

```
feat(marketplace): T29 adenda renegotiateAgreementPricing
```

Incluir **só** ficheiros da lista do task — **não** misturar lixo nem outro task no mesmo commit sem pedido.
