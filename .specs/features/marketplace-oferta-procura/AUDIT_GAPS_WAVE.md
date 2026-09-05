# AUDIT GAPS — Wave paralelismo marketplace (2026-09-05)

**Agente:** TEST & INTEGRATION (observer/preparer)  
**Modo:** report-only — sem alteração de código de produto  
**Baseline Vitest (read-only):** `397` testes · **378 passed** · **19 failed** · `8` ficheiros vermelhos · duração ~173 s  
**Nota flakiness:** falhas concentram-se em scopes em edição paralela (não corrigir aqui).

---

## 1. Inventário de cobertura existente (por tema)

### Multi-pax / pricing / quatro Ns

| Área | Ficheiros de teste | Cobertura actual | Lacuna |
|------|-------------------|------------------|--------|
| Resolução preço dual + resto | `resolveAgreementPricing.test.js`, `AgreementsE2E.test.jsx` | TOTAL N=3/4, resto 100k/3, POR_PASSAGEIRO, N=1; anti «dividir por vagas» | Sem assert E2E de sum(quota)=T persistido via RPC real |
| Aceite → acordo 1:N | `AgreementService.test.js` | RPC accept_proposal mock; erro vagas; **no self-accept** | Sem cancelamento das outras M propostas abertas; sem N_actual < N_proposto → fail; sem primeiros N por ordem_insercao |
| Quotas congeladas / leave | `AgreementService.test.js`, `AgreementsE2E.test.jsx`, `MyAgreements.test.jsx` | Leave via RPC; cabeçalho intacto; UI Sair + busy | Sem «todos saem → cancelado»; sem assert N_contrato vs N_activos pós-leave em UI |
| Adenda temporal | `AgreementService.test.js`, `MyAgreements.test.jsx` | renegotiateAgreementPricing POR/TOTAL + auth; CTA motorista; preview | Copy «mês seguinte» vs aplica já pouco assertado; sem regressão leave≠adenda cruzada |
| Capacidade global | matchingFilters canAcceptDirectly / waitlist | N vs vagas no match | Sem teste soma N_activos em vários acordos da mesma oferta (MKT-06) |

### Flex / matching

| Área | Testes | Cobertura | Lacuna |
|------|--------|-----------|--------|
| Publish flex sem OD | `OfertaService.test.js`, `PublishRoute.test.jsx` | create flex OD null; fixa exige OD; copy Oferta flexível | Baseline: 1 fail OfertaService (isOfertaFlexivel/label — mid-edit) |
| Matching dual | `matchingFilters.test.js`, `MatchingService.test.js` | Fixa geo+tempo; flex sem OD; dias; waitlist; bidireccional | Sem teto preço suave; sem regressão «residência não filtra» explícita |
| Hub flex UX | `DriverDashboard.test.jsx` | Ofertas + inbox + proposta B | Baseline: 2 fails (label flex / lista procuras flex) |

### Propostas A/B / contraparte / inbox

| Área | Testes | Cobertura | Lacuna |
|------|--------|-----------|--------|
| Create + reject | `PropostaService.test.js` | Snapshot N; grupo_id se N>1; reject RPC; no self-reject | Sem create sentido B assert created_by; sem cancel própria enviada |
| Inbox filter | `propostaInbox.test.js` | filterPropostasParaInbox | Baseline: 5 fails — exports filterPropostasEnviadas / resolvePropostaInbox ausentes (mid-edit) |
| Inbox UI A/B | `PassengerDashboard.test.jsx`, `DriverDashboard.test.jsx` | Aceitar B no hub pax; ocultar próprias no motorista | Sem rejeição B no hub pax; sem «criador tenta Aceitar» na UI |
| Deep links | `notificationRouter.test.js` | inbox passageiro/motorista | 1 fail normalização maiúsculas/espaços |
| Review card / mapa | `PropostaReviewCard.test.jsx`, `propostaReview.test.js`, `PreferentialPointsMap.test.jsx` | Preço humano; mapa 1-based; jargon | 2 fails avisoComposicao object vs string |

### Grupo

| Área | Testes | Cobertura | Lacuna |
|------|--------|-----------|--------|
| Serviço n_maximo / entrada | `GrupoService.test.js`, `ProcuraService.test.js` | create, completo, pedidos, aprovar/rejeitar owner, sync N | Baseline: 2 fails sairDoGrupo; ECONNREFUSED :54321 (ruído) |
| UI grupo | `GrupoProcuraPanel.test.jsx`, `GrupoDescobertaPanel.test.jsx`, PassengerDashboard | criar, descoberta, pedir entrada, propor incompleto | 3 fails GrupoProcuraPanel |

### Waitlist / faltas / notificações

| Área | Testes | Cobertura | Lacuna |
|------|--------|-----------|--------|
| Waitlist | `WaitlistService.test.js`, PassengerDashboard | enqueue, promote RPC sem auto-aceitar, estados UI | Sem leave→promote E2E; sem «oferta cheia continua visível» |
| Faltas | `AbsenceService*.test.js`, `AbsenceTracker.test.jsx` | sem /4; passenger_id; hub sem routes | Sem fórmula 30000/22 assertada |
| Notif | `notificationRouter.test.js` | proposal_received, fallbacks | waitlist_promoted / match_available pouco cobertos |

### RLS / RPC

Cobertura só via mocks Supabase RPC. Sem suite Postgres/RLS (gap pós-wave / MCP).

---

## 2. Gaps vs aceitação (priorizados)

### P0 — bloquear audit final se vermelho após wave

1. No self-accept/reject (T32) — serviço ok; falta UI + regressão A/B estável.
2. PropostaInbox exports estáveis (filterPropostasEnviadas, resolvePropostaInbox).
3. Leave RPC atómica + quotas — não regredir P0 hardening.
4. Flex sem OD + matching dual — UI hubs vermelhos mid-wave.
5. Snapshot N_proposto imutável — UI aviso pós-aprovação a falhar.

### P1 — gaps reais de cenário

| # | Gap | Spec | Pós-wave |
|---|-----|------|----------|
| G1 | Aceite cancela outras propostas abertas | MKT-03 AC7 | mock pós-accept |
| G2 | N_actual < N_proposto ⇒ accept falha | MKT-03 AC8 | AgreementService/E2E |
| G3 | Aceite primeiros N por ordem_insercao | MKT-03 AC8 | mock 4 membros N=2 |
| G4 | Capacidade = soma N_activos multi-acordo | MKT-06 | teste capacidade |
| G5 | Leave → promote_waitlist best-effort | MKT-05/08 | mock leave+promote |
| G6 | Sense B createProposta created_by motorista | MKT-18 | PropostaService |
| G7 | Copy adenda «próximo mês» vs aplica já | MKT-13 | assert UI |
| G8 | Router waitlist_promoted | MKT-12 | notificationRouter |
| G9 | Falta quota/dias_uteis numérica | MKT-07 | AbsenceService |
| G10 | Overbooking 2 aceites | MKT-03 AC6 | checklist MCP |
| G11 | RLS sem UPDATE client tabelas críticas | P0 | advisors SQL |
| G12 | UI sem jargon hubs | design | grep + smoke |

### P2

- Matching teto preço; todos saem → cancelado; traceability MKT-* Status na spec.

---

## 3. Cenários auditoria integração final

Checklist pós-wave. Preferir novo `MarketplaceAuditScenarios.test.jsx` (APIs públicas + mocks).

**A Pricing & Ns:** POR/TOTAL+resto; leave ≠ recálculo; adenda sim; nunca vagas/n_maximo/N_activos.  
**B Capacidade & waitlist:** direct vs waitlist; promote notificada sem auto-accept; leave+FIFO.  
**C Grupo & Ns:** 2/4 negociável; entrada não muta proposta; nova proposta N=3; ordem_insercao; N_actual<N_proposto fail.  
**D A/B & contraparte:** sense A/B; no self-accept; deep link inbox.  
**E Flex & matching:** publish sem OD; flex sem geo; dias; bidireccional.  
**F UI 1:N:** MyAgreements N linhas; adenda motorista; falta se activo.  
**G Segurança (MCP):** RPCs DEFINER; DROP UPDATE client; membros owner-only.

---

## 4. Baseline suite (snapshot wave)

```
Test Files  8 failed | 51 passed (59)
Tests       19 failed | 378 passed (397)
```

Ficheiros vermelhos (mid-wave — NÃO fix daqui): DriverDashboard (2), PassengerDashboard (3), GrupoProcuraPanel (3), GrupoService (2), OfertaService (1), propostaInbox (5), propostaReview (2), notificationRouter (1).

---

## 5. Plano pós-wave

1. Re-correr `npm run test:run` — alvo ~397 verdes.
2. Fechar mid-edit P0 (inbox exports, labels flex, sairDoGrupo, avisoComposicao).
3. Novo `MarketplaceAuditScenarios.test.jsx` blocos A–E.
4. Checklist G via Supabase MCP (read-only).
5. Actualizar traceability MKT-* (chore docs).
6. Commit só se o utilizador pedir.

## 6. NÃO alterado

Scopes Matching/Group/Proposal/Agreement/Flex/UI · produto · P0 · commits.
