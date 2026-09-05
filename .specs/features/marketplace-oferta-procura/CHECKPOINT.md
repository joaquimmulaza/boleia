# Checkpoint — Marketplace Oferta / Procura

**Data:** 2026-09-05 (~09:15 UTC+1)  
**Branch:** `main` (T29 + **T30 uncommitted**; T31 already on `origin/main`)  
**Chat:** T30 Done (design + TDD paralelo A/B/C + UI QA + code-review **APPROVE** ×2 ciclos).  
**Usar este ficheiro** para retomar sem perder contexto.

**Commits relevantes:**
- `178cd50` — T24 hub motorista multi-pax  
- `dc52862` — **T25–T28** (E2E quotas, waitlist, oferta dias, detalhe acordo 1:N)  
- `8a0111e` — **T31** n_maximo + grupo público / pedir entrada (**pushed**)  
- `443d149` — sync CHECKPOINT pós-push T31  
- *(uncommitted)* **T29** adenda / `renegotiateAgreementPricing`  
- *(uncommitted)* **T30** mapa N pontos preferenciais (MapLibre)

---

## Prompt para colar no chat novo

```
Continua marketplace a partir de:
.specs/features/marketplace-oferta-procura/CHECKPOINT.md

Phase 6 T22–T31 (+ T29/T30) Done. T29+T30 UNCOMMITTED — commit só se eu pedir
(ficheiros listados no CHECKPOINT; NÃO misturar lixo .cline/.codex/.cursor).

Decisão produto 2026-09-05 (docs): motorista flexível SEM zona/OD obrigatório;
propostas bidireccionais; aceite só contraparte. Tasks T32–T35 Planned —
NÃO implementar código até eu pedir.

Ler CHECKPOINT + AGENTS.md + spec.md (secção flexível / propostas).

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
Matching MVP: oferta **fixa** ±15 min + raio OD 2500 m; oferta **flexível** sem OD/zona (docs 2026-09-05; código T34/T35 Planned); waitlist se N > vagas (sem auto-aceitar).  
Promoção waitlist = **notificação** (`waitlist_promoted`) + estado `notificada` — **nunca** auto-aceitar.  
**Adenda (T29 Done):** único caminho para mutar preços / `N_contrato` — copy «mês seguinte»; MVP aplica valores de imediato via RPC.  
**Mapa (T30 Done):** pins 1-based dos pontos preferenciais do snapshot antes do aceite (MapLibre + OSM).  
**Produto (2026-09-05, só docs):** motorista flexível sem zona; propostas A/B; aceite só contraparte; cadeia Procura→M propostas→1 acordo 1:N. **Não** implementar até pedido (T32–T35).

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
| 7 Flexível + propostas bi | T32–T35 Planned | **Só docs** (2026-09-05) — sem código até pedido |

### Maturidade (~)

| Camada | % | Nota |
|---|---|---|
| Schema + RPC | ~99% | `accept_proposal` + `promote_waitlist` + `renegotiate_agreement_pricing` + `n_maximo` · **débito T32:** bloquear `created_by` |
| Serviços | ~99% | Adenda + leave + waitlist + grupo · **débito T34/T35:** flex sem OD + `findCompatibleProcuras` |
| UI produto | ~99% | Adenda + mapa T30 · **débito T33/T34:** inbox B + PublishRoute OD opcional |
| E2E N>1 | ~90% | T25 + T29 testes adenda |

---

## Feito (não reinventar) — T22–T31 + T29 + T30

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
| T27 | Oferta dias + rota flexível | `dc52862` |
| T28 | Detalhe acordo 1:N | `dc52862` |

---

## O que falta

```
Phase 6 marketplace bifurcação — COMPLETA (T22–T31).
Próximo: Phase 7 T32–T35 **quando o utilizador pedir** (docs já actualizados). Commits T29/T30 só sob pedido.
```

---

## Stack / serviços canónicos

**BD** (`boleia` / `fdclrbcgytnuqcrpsevw`):  
`ofertas_capacidade`, `procuras`, `grupos` (+`n_maximo`), `membros_grupo` (+pickup/dropoff coords), `propostas`, `lista_espera`, `acordos`, `acordos_passageiros`, `faltas`, `veiculos`.  
RPCs: `accept_proposal`, `promote_waitlist`, `renegotiate_agreement_pricing`.

**Serviços:** `OfertaService`, `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService` (+ `renegotiateAgreementPricing`), `MatchingService`, `WaitlistService`, `AbsenceService`, `LocationService` (Photon), `ProfileService.findPassageiroByTelefone`.  
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
7. Working tree: T29 + T30 uncommitted — **não** misturar `.cline`/`.codex`/`.cursor` lixo  
8. Spec/planos prevalecem sobre v0 se houver conflito  

---

## Handoff git (snapshot)

```
(uncommitted) feat(marketplace): T30 mapa N pontos preferenciais (MapLibre)
(uncommitted) feat(marketplace): T29 adenda renegotiateAgreementPricing
443d149 chore(marketplace): sincronizar CHECKPOINT após push T31
8a0111e feat(marketplace): T31 n_maximo + grupo público / pedir entrada
```

Mensagens sugeridas (quando pedires — **commits separados** preferível):

```
feat(marketplace): T30 mapa N pontos preferenciais
```

```
feat(marketplace): T29 adenda renegotiateAgreementPricing
```

Incluir **só** ficheiros da lista T29 ou T30 — **não** misturar lixo nem o outro task no mesmo commit sem pedido.
