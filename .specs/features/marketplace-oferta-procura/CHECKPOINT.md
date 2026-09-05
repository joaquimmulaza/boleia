# Checkpoint — Marketplace Oferta / Procura

**Data:** 2026-09-05 (~07:30 UTC+1)  
**Branch:** `main` (ahead of `origin/main` — **não pushed**; pedir push explicitamente)  
**Chat anterior:** T31 implementada (design + TDD + UI QA + code review **APPROVE**); contexto cheio → **continuar noutro chat**.  
**Usar este ficheiro** para retomar sem perder contexto.

**Commits relevantes:**
- `178cd50` — T24 hub motorista multi-pax  
- `dc52862` — **T25–T28** (E2E quotas, waitlist, oferta dias, detalhe acordo 1:N)  
- `8a0111e` — **T31** n_maximo + grupo público / pedir entrada (**pushed** `origin/main`)  

---

## Prompt para colar no chat novo

```
Continua marketplace a partir de:
.specs/features/marketplace-oferta-procura/CHECKPOINT.md

Próxima task: T29 (P2 — adenda / renegotiateAgreementPricing).

Antes de código:
0. T31 já está em `8a0111e` (pushed) — NÃO reinventar.
1. Ler este CHECKPOINT.md (verdade dura + feito T22–T31 + o que falta)
2. tasks.md Phase 6 — secção T29 (e T30 se relevante)
3. Plano .cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md
4. spec.md: «Quatro Ns» + invariante de quota + adenda / MKT-13
5. design.md — para T29: ui-designer → gate → implementer se houver UI

Regras: AGENTS.md + .cursorrules; TDD; JS+JSDoc; sem TS/toast;
DDL só via Supabase MCP; copy UI humana (nunca N_actual / N_proposto / POR_PASSAGEIRO).
Não reintroduzir «grupo incompleto = não pode propor».
Não invalidar propostas abertas só porque N_actual mudou.
Não recalcular quotas do mês ao leavePassenger.
Não auto-aceitar waitlist (só notif waitlist_promoted).
Adenda T29 = ÚNICO caminho para mutar preços / N_contrato (mês seguinte).

Orquestração: .cursor/skills/tlc-spec-driven + boleia-agent-loop;
paralelismo com .cursor/skills/subagent-creator quando scopes disjuntos.
UI SoT: v0 (One) + shadcn JSX + UI Skills + Mobbin free-safe (nunca Penpot como gate).

Git: `8a0111e` = T31 (pushed); `dc52862` = T25–T28; push só se eu pedir.
```

---

## Verdade dura (não renegociar)

Cardinalidade **1 motorista : N passageiros** no acordo; procura/grupo → **M** propostas; aceitar 1 → **1 acordo**.  
Preço dual `POR_PASSAGEIRO` | `TOTAL_ACORDO`; lotação do veículo **nunca** divide preço.  
Quotas **congeladas** na aceitação; saída de pax **não** recalcula mês corrente.  
Capacidade global = soma `N_activos` nos acordos da oferta.  
Matching MVP: ±15 min, raio OD 2500 m; waitlist se N > vagas (sem auto-aceitar).  
Promoção waitlist = **notificação** (`waitlist_promoted`) + estado `notificada` — **nunca** auto-aceitar.  
**Adenda (T29):** único caminho para mutar preços / `N_contrato` — aplica-se ao **mês seguinte**, nunca recalcular mês corrente via leave.

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
| `N_contrato` | `acordos.n_passageiros_contrato` | Congelado no aceite; base do preço do contrato |
| `N_activos` | COUNT pax activos no acordo | Só vagas/UI lotação — nunca preço |

**Exemplo canónico:** grupo 2/4; motorista TOTAL 100.000 com `N_proposto=2` → 50.000 Kz/pax. Entra 3.º → proposta **inalterada**. Nova negociação a 3 → nova proposta + regra de resto.

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
| 6 Bifurcação | **T22–T28 + T31 Done** (gates APPROVE) | **T29← AQUI** |
| | T29 P2, T30 P3 | Pending |

### Maturidade (~)

| Camada | % | Nota |
|---|---|---|
| Schema + RPC | ~96% | `accept_proposal` + `promote_waitlist` + `n_maximo`/pedidos; falta adenda T29 |
| Serviços | ~97% | Leave + waitlist + entrada pública; quotas imutáveis |
| UI produto | ~94% | Oferta dias/flex; detalhe 1:N; waitlist; grupo público |
| E2E N>1 | ~85% | T25 Vitest; smoke browser opcional |

---

## Feito (não reinventar) — T22–T31

### T31 — `n_maximo` + grupo público / pedir entrada ← **Done (`8a0111e`, pushed)**

**Gates:** design APPROVE · UI QA APPROVE · code-review APPROVE (ciclo 2 após fix mensagens).

**DDL (Supabase MCP, project `fdclrbcgytnuqcrpsevw`):**
- `grupos.n_maximo` INTEGER NOT NULL DEFAULT 4, CHECK 2–8
- `membros_grupo.estado`: `activo` | `saiu` | `pendente` | `rejeitado`

**Serviço `GrupoService.js`:**
- `createGrupo(procuraId, nome, nMaximo)`
- `listGruposAbertos({ excludeOwnerId, excludeGrupoId })`
- `pedirEntradaGrupo` → estado `pendente` (**não** sync N)
- `listPedidosPendentes` / `aprovarEntrada` / `rejeitarEntrada` (só se `pendente`)
- `addMembroGrupo` respeita `n_maximo`; `syncNCandidato` só conta `activo`
- Aprovar **não** toca tabela `propostas`

**UI:**
- `GrupoProcuraPanel.jsx` — stepper «Até quantas pessoas?» 2–8; badge «Grupo · N de M»; pedidos Aceitar/Recusar; «Ou convidar por telefone» (fallback)
- `GrupoDescobertaPanel.jsx` — «Grupos abertos» + Pedir entrada + empty
- Wired em `PassengerDashboard.jsx` (`/passageiro`)

**Testes:** `GrupoService.test.js`, `GrupoProcuraPanel.test.jsx`, `GrupoDescobertaPanel.test.jsx`, mocks em `PassengerDashboard.test.jsx` / `ProcuraService.test.js`

**Design:** v0 https://v0.app/chat/jo0mXnLQf42 · secção T31 em `design.md` · Mobbin degradado (plano free)

**Ficheiros T31 (para commit quando pedido):**
```
src/services/GrupoService.js
src/services/GrupoService.test.js
src/services/ProcuraService.test.js
src/components/GrupoProcuraPanel.jsx
src/components/GrupoProcuraPanel.test.jsx
src/components/GrupoDescobertaPanel.jsx
src/components/GrupoDescobertaPanel.test.jsx
src/pages/PassengerDashboard.jsx
src/pages/PassengerDashboard.test.jsx
.specs/features/marketplace-oferta-procura/{CHECKPOINT,design,tasks}.md
.specs/project/STATE.md
AGENTS.md
```

### T22 — UI Grupo
- `GrupoProcuraPanel` criar + membros; integrado hub passageiro

### T23 — Proposta grupo vivo
- `createProposta` com `grupo_id`; `N_proposto = N_actual`; sem bloqueio «incompleto»; sync não invalida propostas

### T24 — Hub motorista (`178cd50`)
- `PropostaReviewCard` / enrich; Aceitar → RPC `accept_proposal`

### T25 — E2E quotas (`dc52862`)
- `AgreementsE2E.test.jsx`; `leavePassenger` quotas restantes imutáveis

### T26 — Waitlist promoção
- RPC `promote_waitlist`; notif `waitlist_promoted`; **sem** auto-aceitar

### T27 — Publicar oferta
- `PublishRoute`: dias Seg–Dom + «Rota flexível»

### T28 — Detalhe acordo 1:N
- `MyAgreements`: «Preço combinado»; lista N; `ConfirmationModal` `busy`

---

## O que falta (ordem)

```
T29 P2  ← COMEÇAR AQUI (adenda / renegotiateAgreementPricing)
T30 P3  (mapa N pontos preferenciais)
```

### T29 (P2) — Adenda de preço ← **PRÓXIMA**

**Do (tasks.md / MKT-13):**
- Único caminho para mutar preços / `N_contrato` (mês seguinte)
- **Não** recalcular mês corrente no leave
- Fora da wave imediata anterior — agora é a prioridade

**Verify (esperado):** adenda explícita altera preços só para o período seguinte; leave continua a preservar quotas do mês.

**Ficheiros-chave prováveis:**
1. Este `CHECKPOINT.md` + `tasks.md` T29 + `spec.md` MKT-13 / invariante quota
2. `AgreementService.js` / RPC ou mutação controlada
3. UI em `MyAgreements.jsx` (se houver ecrã de adenda) → ui-designer primeiro
4. Testes TDD (invariante leave + adenda)

### T30 (P3) — Mapa N pontos
- Pontos dos membros cobertos pelo `N_proposto` antes do aceite
- Placeholder OK até design

---

## Stack / serviços canónicos

**BD** (`boleia` / `fdclrbcgytnuqcrpsevw`):  
`ofertas_capacidade`, `procuras`, `grupos` (+`n_maximo`), `membros_grupo` (+pendente/rejeitado), `propostas`, `lista_espera`, `acordos`, `acordos_passageiros`, `faltas`, `veiculos`.  
RPCs: `accept_proposal`, `promote_waitlist`.

**Serviços:** `OfertaService`, `ProcuraService`, `GrupoService` (T31 APIs), `PropostaService`, `AgreementService`, `MatchingService`, `WaitlistService`, `AbsenceService`, `LocationService` (Photon), `ProfileService.findPassageiroByTelefone`.

**UI paths:** `/passageiro` (procura + grupo + **descoberta**), `/motorista`, `/publicar-trajeto`, `/veiculo`, `/acordos`, `/faltas`, `/perfil`.

**Removido (não recriar):** `RouteService`, `requestSeat`, cards `Acordo*` com `routes`.

---

## Contas QA

- Motorista: `qa.motorista.mkt+20260904@boleiacerta.test` / `TesteQA123!`
- Passageiro: `qa.passageiro.mkt+20260904@boleiacerta.test` / `TesteQA123!`
- T31 / N>1: vários perfis passageiro (descoberta pública)

---

## Regras de execução

1. TDD: teste → falha → código → verde  
2. Só `.js` / `.jsx` + JSDoc  
3. DDL **só** Supabase MCP  
4. Copy humana; nunca jargon de Ns / `POR_PASSAGEIRO`  
5. Design SoT: v0/shadcn/UI Skills (Penpot descontinuado)  
6. Commit / push **só** se o utilizador pedir  
7. Um passo de cada vez — **T29** (após opcional commit T31)  
8. Spec/planos prevalecem sobre v0 se houver conflito  
9. Working tree pode ter lixo (`.cline` deletions, hooks Cursor, etc.) — **não** misturar no commit marketplace  

---

## Handoff git (snapshot)

```
8a0111e feat(marketplace): T31 n_maximo + grupo público / pedir entrada
dc52862 feat(marketplace): T25–T28 quotas E2E, waitlist, oferta dias e detalhe 1:N
178cd50 feat(marketplace): T24 hub motorista rever proposta multi-passageiro
```

`main` = `origin/main` (synced após push de 2026-09-05).

---

## Fora de âmbito

Gateway pagamento; substituto automático; turn-by-turn; TypeScript; toast; `rotas_diarias` / Google Maps; dual-write; quotas desiguais; reintroduzir matching 1:1; auto-aceitar waitlist; reinventar T22–T31.
