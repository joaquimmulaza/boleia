# Checkpoint — Marketplace Oferta / Procura

**Data:** 2026-09-04 (noite)  
**Branch:** `main`  
**Chat:** Phase 6 wave T25–T28 — todos os gates APPROVE (T25–T28)  
**Estado git:** alterações **por commit** — pedir commit/push explicitamente  
**Usar este ficheiro** para retomar noutro chat sem perder contexto.

---

## Prompt para colar no chat novo

```
Continua marketplace a partir de:
.specs/features/marketplace-oferta-procura/CHECKPOINT.md

Próxima task: T31 (n_maximo + grupo público / pedir entrada).

Obrigatório ler primeiro:
1. Este CHECKPOINT.md (verdade dura + grupo vivo + o que falta)
2. tasks.md Phase 6 (T31 em diante)
3. Plano .cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md
4. spec.md secção «Quatro Ns» + «Grupo = procura colectiva viva» + invariante de quota

Regras: AGENTS.md + .cursorrules; TDD; JS+JSDoc; sem TS/toast;
DDL só via Supabase MCP; copy UI humana (nunca N_actual / N_proposto / POR_PASSAGEIRO).
Não reintroduzir «grupo incompleto = não pode propor».
Não invalidar propostas abertas só porque N_actual mudou.
Não recalcular quotas do mês ao leavePassenger.
Não auto-aceitar waitlist (só notif waitlist_promoted).
```

---

## Verdade dura (não renegociar)

Cardinalidade **1 motorista : N passageiros** no acordo; procura/grupo → **M** propostas; aceitar 1 → **1 acordo**.  
Preço dual `POR_PASSAGEIRO` | `TOTAL_ACORDO`; lotação do veículo **nunca** divide preço.  
Quotas **congeladas** na aceitação; saída de pax **não** recalcula mês corrente.  
Capacidade global = soma `N_activos` nos acordos da oferta.  
Matching MVP: ±15 min, raio OD 2500 m; waitlist se N > vagas (sem auto-aceitar).  
Promoção waitlist = **notificação** (`waitlist_promoted`) + estado `notificada` — **nunca** auto-aceitar.

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
| 4 UI | T14–T19 | **Done** |
| 5 Docs | T20–T21 | **Done** |
| 6 Bifurcação | T22–T28 **Done** | **T31← AQUI** |
| | T29 P2, T30 P3, **T31** | Pending |

### Maturidade (~)

| Camada | % | Nota |
|---|---|---|
| Schema + RPC | ~92% | `accept_proposal` + `promote_waitlist`; falta `n_maximo` (T31) |
| Serviços | ~95% | Leave + promoção waitlist; quotas imutáveis |
| UI produto | ~90% | Oferta dias/flex; detalhe acordo 1:N; waitlist estados |
| E2E N>1 | ~85% | T25 TOTAL_ACORDO + leave; falta smoke browser opcional |

---

## Feito neste chat (não reinventar)

### T25 — E2E TOTAL_ACORDO + leave (gates APPROVE)
- `AgreementsE2E.test.jsx` real; `leavePassenger` valida quotas restantes
- 21 testes pricing/agreement/E2E

### T26 — Waitlist promoção (gates APPROVE)
- RPC `promote_waitlist`; `promoteWaitlist`; hook em `leavePassenger` (best-effort)
- UI hub: activa / notificada — **sem** auto-aceitar
- Code-review + UI QA APPROVE

### T27 — Publicar oferta dias + flex (gates APPROVE)
- `PublishRoute`: Seg–Dom default Seg–Sex; toggle «Rota flexível»
- 5/5 testes

### T28 — Detalhe acordo 1:N (gates APPROVE ciclo 2)
- `MyAgreements`: Preço combinado/congelado; lista N; destaque passageiro
- CTA falta só se activo; `ConfirmationModal` `busy`
- 13 testes MyAgreements + ConfirmationModal

### Docs
- `tasks.md` · este `CHECKPOINT.md` · `AGENTS.md` · `STATE.md` · `design.md` (T28)

---

## O que falta (ordem)

```
T31                    ← COMEÇAR AQUI (n_maximo + grupo público / pedir entrada)
T29 P2 / T30 P3
```

### T31 — `n_maximo` + grupo público / pedir entrada (substitui telefone como fluxo principal)

### T29 / T30 — Adenda P2; mapa N pontos P3

---

## Stack / serviços canónicos

**BD** (Supabase `boleia` / `fdclrbcgytnuqcrpsevw`):  
`ofertas_capacidade`, `procuras`, `grupos`, `membros_grupo`, `propostas`, `lista_espera`, `acordos`, `acordos_passageiros`, `faltas`, `veiculos`.  
RPCs: `accept_proposal`, `promote_waitlist`.

**Serviços:** `OfertaService`, `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService`, `MatchingService`, `WaitlistService` (`enqueueWaitlist`, `promoteWaitlist`, listagens), `AbsenceService`, `LocationService`, `ProfileService.findPassageiroByTelefone`.

**UI paths:** `/passageiro` (grupo + matches + waitlist), `/motorista`, `/publicar-trajeto`, `/veiculo`, `/acordos`, `/faltas`, `/perfil`.

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
5. Design SoT: v0/shadcn/UI Skills (Penpot descontinuado)  
6. Commit / push **só** se o utilizador pedir  
7. Um passo de cada vez — **T31**  
8. Spec/planos prevalecem sobre v0 se houver conflito  

---

## Ficheiros-chave para T31

1. Este `CHECKPOINT.md`  
2. `.specs/features/marketplace-oferta-procura/tasks.md` (T31)  
3. `GrupoService` / `GrupoProcuraPanel` / schema `grupos`  
4. Spec: grupo vivo + descoberta pública  

---

## Fora de âmbito

Gateway pagamento; substituto automático; turn-by-turn; TypeScript; toast; `rotas_diarias` / Google Maps; dual-write; quotas desiguais; reintroduzir matching 1:1.
