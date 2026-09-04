# Checkpoint — Marketplace Oferta / Procura

**Data:** 2026-09-04 (noite)  
**Branch:** `main`  
**Chat:** T24 Hub motorista multi-pax (design → implement paralelo → review ciclo 2 APPROVE)  
**Estado git:** alterações **por commit** (T24) — pedir commit/push explicitamente se necessário  
**Usar este ficheiro** para retomar noutro chat sem perder contexto.

---

## Prompt para colar no chat novo

```
Continua marketplace a partir de:
.specs/features/marketplace-oferta-procura/CHECKPOINT.md

Próxima task: T25 (E2E TOTAL_ACORDO N=3/4 + leave sem recalcular quotas).

Obrigatório ler primeiro:
1. Este CHECKPOINT.md (verdade dura + grupo vivo + o que falta)
2. tasks.md Phase 6 (T25 em diante)
3. Plano .cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md
4. spec.md secção «Quatro Ns» + «Grupo = procura colectiva viva» + invariante de quota

Regras: AGENTS.md + .cursorrules; TDD; JS+JSDoc; sem TS/toast;
DDL só via Supabase MCP; copy UI humana (nunca N_actual / N_proposto / POR_PASSAGEIRO).
Não reintroduzir «grupo incompleto = não pode propor».
Não invalidar propostas abertas só porque N_actual mudou.
Não recalcular quotas do mês ao leavePassenger.
```

---

## Verdade dura (não renegociar)

Cardinalidade **1 motorista : N passageiros** no acordo; procura/grupo → **M** propostas; aceitar 1 → **1 acordo**.  
Preço dual `POR_PASSAGEIRO` | `TOTAL_ACORDO`; lotação do veículo **nunca** divide preço.  
Quotas **congeladas** na aceitação; saída de pax **não** recalcula mês corrente.  
Capacidade global = soma `N_activos` nos acordos da oferta.  
Matching MVP: ±15 min, raio OD 2500 m; waitlist se N > vagas (sem auto-aceitar).

### Grupo = procura colectiva viva

| Errado | Certo |
|---|---|
| Grupo incompleto ⇒ não pode propor/receber | Incompleto ⇒ aberto a membros **e** negociável com `N_proposto = N_actual` |
| Preço no grupo | Preço na **oferta/proposta** do motorista |
| Entrada só por telefone | Público/descobrível + pedido de entrada (**T31**); telefone = fallback |
| Entrar membro invalida propostas | Propostas **mantêm** snapshot; novo N ⇒ **nova** proposta |

### Quatro Ns

| Símbolo | BD / campo | Uso |
|---|---|---|
| `N_actual` | `procuras.n_candidato` | Membros activos agora; matching; UI «Grupo · 2 pessoas» |
| `N_proposto` | `propostas.n_passageiros_propostos` | Snapshot da negociação; imutável na versão |
| `N_contrato` | `acordos.n_passageiros_contrato` | Congelado no aceite; base do preço do contrato |
| `N_activos` | COUNT pax activos no acordo | Só vagas/UI lotação — nunca preço |

**Exemplo canónico:** grupo 2/4; motorista TOTAL 100.000 com `N_proposto=2` → 50.000 Kz/pax. Entra 3.º → proposta **inalterada**. Nova negociação a 3 → nova proposta + regra de resto.

Alias legado: `N_candidato` nos docs antigos = `N_actual`. Coluna BD mantém-se `n_candidato`.

---

## Progresso

| Fase | Tasks | Status |
|------|-------|--------|
| 1 Utils | T1–T3 | **Done** |
| 2 Schema MCP | T4–T7 | **Done** |
| 3 Serviços | T8–T13 | **Done** |
| 4 UI | T14–T19 | **Done** (fluxo N=1 + grupo UI) |
| 5 Docs | T20–T21 | **Done** |
| 6 Bifurcação | T22–T24 **Done** | **T25← AQUI** |
| | T25–T28, T29 P2, T30 P3, **T31** | Pending |

### Maturidade (~)

| Camada | % | Nota |
|---|---|---|
| Schema + RPC | ~90% | `accept_proposal` com LIMIT `N_proposto`; falta `n_maximo` (T31) |
| Serviços | ~85% | Grupo + proposta + enrich review OK; falta promoção waitlist |
| UI produto | ~75% | Hub motorista multi-pax (T24); falta detalhe acordo 1:N |
| E2E N>1 | ~45% | Review+Aceitar UI OK; falta TOTAL_ACORDO E2E + leave (T25) |

---

## Feito neste chat (não reinventar)

### T22 — UI Grupo
- `src/components/GrupoProcuraPanel.jsx` (+ testes)
- Criar grupo → dono = 1.º membro; adicionar por telefone; pickup opcional
- Integrado em `PassengerDashboard` (`/passageiro`)
- Serviços: `getGrupoByProcura`, `listMembrosGrupo`, `findPassageiroByTelefone`

### T23 — Proposta + revisão grupo vivo
- `createProposta` com `grupo_id`; `N_proposto = N_actual` (membrosCount)
- **Não** bloqueia por «grupo incompleto»
- Exige entidade grupo só se N>1
- `syncNCandidato` **não** invalida propostas abertas
- Waitlist também envia `grupo_id`
- RPC migração: `marketplace_accept_proposal_n_proposto_snapshot`  
  → inclui primeiros `N_proposto` membros se `N_actual > N_proposto`; falha se `N_actual < N_proposto`

### T24 — Hub motorista multi-pax
- `src/utils/propostaReview.js` — `buildPropostaReview` / `loadPropostaReview` (slice N + `resolveAgreementPricing`)
- `enrichPropostasForReview` em `PropostaService` → shape `{ proposta, titulo, membros, pricing, avisoComposicao }`
- `PropostaReviewCard` — lista pax + pickup, preço humano, `temResto`, ConfirmationModal
- `DriverDashboard` — enrich + loading skeleton (sem empty/stale falso)
- Aceitar → `createAgreementFromProposal` (RPC) inalterado
- Code-reviewer + UI QA: **APPROVE** (ciclo 2)

### Docs actualizados
- `spec.md` / `context.md` / `design.md` (secção T24)
- Plano `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- `tasks.md` · `AGENTS.md` · `.specs/project/STATE.md`

### Testes
Última corrida T24: **27 verdes** (propostaReview + PropostaService + PropostaReviewCard + DriverDashboard).

---

## O que falta (ordem)

```
T25                    (núcleo; sequencial após T24)
T26 ∥ T27 ∥ T28        (após T24 — paralelizáveis)
T31                    (n_maximo + descoberta pública / pedido entrada)
T29 P2 / T30 P3
```

### T25 — E2E TOTAL_ACORDO N=3/4 + leave sem recalcular quotas ← **COMEÇAR AQUI**

### T26 — Promoção waitlist (notif, sem auto-aceitar)

### T27 — UI oferta: dias + flexibilidade

### T28 — Detalhe acordo 1:N (lista pax + preço congelado)

### T31 — `n_maximo` + grupo público / pedir entrada (substitui telefone como fluxo principal)

### T29 / T30 — Adenda P2; mapa N pontos P3

---

## Stack / serviços canónicos

**BD** (Supabase `boleia` / `fdclrbcgytnuqcrpsevw`):  
`ofertas_capacidade`, `procuras`, `grupos`, `membros_grupo`, `propostas`, `lista_espera`, `acordos`, `acordos_passageiros`, `faltas`, `veiculos`.

**Serviços:** `OfertaService`, `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService`, `MatchingService`, `WaitlistService`, `AbsenceService`, `LocationService`, `ProfileService.findPassageiroByTelefone`.

**UI paths:** `/passageiro` (grupo + matches), `/motorista`, `/publicar-trajeto`, `/veiculo`, `/acordos`, `/faltas`, `/perfil`.

**Removido (não recriar):** `RouteService`, `requestSeat`, cards `Acordo*` com `routes`.

---

## Contas QA

- Motorista: `qa.motorista.mkt+20260904@boleiacerta.test` / `TesteQA123!`
- Passageiro: `qa.passageiro.mkt+20260904@boleiacerta.test` / `TesteQA123!`
- Para N>1: criar 2–3 perfis passageiro com telefones distintos (até T31)

---

## Regras de execução

1. TDD: teste → falha → código → verde  
2. Só `.js` / `.jsx` + JSDoc  
3. DDL **só** Supabase MCP  
4. Copy humana; nunca jargon de Ns / `POR_PASSAGEIRO`  
5. Penpot-first quando MCP ligado; senão `v0-reference/`  
6. Commit / push **só** se o utilizador pedir  
7. Um passo de cada vez — **T24 primeiro**  
8. Spec/planos prevalecem sobre v0 se houver conflito  

---

## Ficheiros-chave para T25

1. Este `CHECKPOINT.md`  
2. `.specs/features/marketplace-oferta-procura/tasks.md`  
3. `src/services/AgreementService.js` (+ testes leave/pricing)  
4. `src/utils/resolveAgreementPricing.js`  
5. RPC `accept_proposal` / testes integração se existirem  
6. Spec: invariante de quota + TOTAL_ACORDO resto  

---

## Fora de âmbito

Gateway pagamento; substituto automático; turn-by-turn; TypeScript; toast; `rotas_diarias` / Google Maps; dual-write; quotas desiguais; reintroduzir matching 1:1.
