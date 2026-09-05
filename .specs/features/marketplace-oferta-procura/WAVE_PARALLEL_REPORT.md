# WAVE PARALLEL REPORT — Marketplace Oferta/Procura

**Agente:** FINAL INTEGRATION & AUDIT  
**Data:** 2026-09-05 (~12:45 UTC+1)  
**Workspace:** `C:\boleia-certa`  
**Commit:** nenhum (pedido explícito do utilizador)

---

## Veredicto geral

| Critério de aceitação | Semáforo | Nota |
|----------------------|----------|------|
| 1. P0 continuam resolvidos | **GREEN** | `leave_passenger`, `leave_grupo_membro`, DROP UPDATE client, join sem auto-aprovação |
| 2. Sem P1 crítico aberto | **GREEN** | P1 `sairDoGrupo` client UPDATE **fechado** (9538f809). Restam gaps de cobertura (G1–G12) — não bloqueiam integração |
| 3. Testes relevantes passam | **GREEN** | **413 passed / 0 failed** · 60 ficheiros |
| 4. Sem contradições UI↔domínio | **GREEN** | Copy humana; flex sem OD; adenda «próximo mês»; cancel/inbox alinhados a RPCs |
| 5. Sem mutação silenciosa N/preço/capacidade | **GREEN** | Mutations via RPC DEFINER; leave ≠ recalcular quotas; sync N_actual não toca propostas |
| 6. Sem «fix» só no frontend do domínio | **GREEN** | Serviços delegam em RPC; UI não inventa regras |
| 7. Auditoria final | **GREEN** | Ver checklist §5; dívida = cobertura de cenários (não regressão P0) |

**STATUS INTEGRAÇÃO:** **GREEN** (pronto para commit quando o utilizador pedir; ver blockers menores em §7).

Baseline pré-wave (`AUDIT_GAPS_WAVE.md`): 378 passed / 19 failed.  
Pós-wave + follow-up RLS: **413 passed / 0 failed** (+35 testes líquidos; mid-edit vermelhos fechados).

---

## 1. Inventário git (sem commit)

Sem marcadores de conflito (`<<<<<<<`). Working tree uncommitted (wave + T29–T35 + P0).

### Produto / testes tocados pela wave

| Área | Ficheiros principais |
|------|----------------------|
| Matching | `matchingFilters.js(.test)`, `MatchingService.js(.test)` |
| Grupo | `GrupoService.js(.test)`, `GrupoProcuraPanel.jsx(.test)` |
| Proposta | `PropostaService.js(.test)`, `propostaInbox.js(.test)`, `PropostaReviewCard`, `notificationRouter` |
| Acordo / adenda | `AgreementService.js(.test)`, `MyAgreements.jsx(.test)`, `AgreementsE2E.test.jsx` |
| Flex UX | `OfertaService`, `PublishRoute`, `DriverDashboard` |
| UI consistência | `OfertaMatchCard.jsx(.test)`, `PassengerDashboard` |
| Specs | `CHECKPOINT`, `AUDIT_GAPS_WAVE`, plan/spec/tasks/STATE/AGENTS |

### Ruído / fora do commit sugerido

- `.agent/subagents/*`, `.cursor/plans/*`, `src/test/marketplaceCoverage.plan.md`
- `node_modules/.vite/vitest/...` (se aparecer)

`git diff --stat HEAD` (snapshot): ~37 ficheiros trackados · +3578 / −882 (antes do follow-up RLS já contado em GrupoService).

---

## 2. Tabela por agente

| Agente | ID | Scope | STATUS | Evidência |
|--------|-----|-------|--------|-----------|
| Matching | d78fe8ff | filters + MatchingService | **DONE** | Dual fixa/flex; dias; bidireccional; 41 testes no âmbito |
| Group | 8bfa2d94 | N_actual vs N_proposto, sair, panel | **DONE** | Aviso composição; UI sair; sync sem invalidar propostas |
| Proposal | 0822e7e8 | cancel RPC, inbox, deep links, criador | **DONE** | `cancel_proposal`; `filterPropostasEnviadas` / `resolvePropostaInbox`; PropostaReviewCard |
| Agreement | b243ed07 | adenda temporal + `acordos_adendas` | **DONE** | `effective_from` próximo mês; UI pendente; RPC `renegotiate` + `apply_due_*` |
| Flex UX | 7beb3968 | publish/hub flex + cancel motorista | **DONE** | Publish sem OD; DriverDashboard cancel wired |
| UI | 836e3857 | OfertaMatchCard + cancel pax | **DONE** | Card matches + PassengerDashboard cancel |
| Test observer | 2741ae6f | gaps report-only | **DONE** | `AUDIT_GAPS_WAVE.md` |
| RLS sairDoGrupo | 9538f809 | RPC leave grupo | **DONE** | `leave_grupo_membro` + JS + testes; P0 RLS intacto |

---

## 3. Suite de testes

```
npm run test:run
Test Files  60 passed (60)
Tests       413 passed (413)
Duration    ~21 s
```

Nota: `ECONNREFUSED 127.0.0.1:54321` (Supabase local ausente) — ruído; não falha Vitest.

Nenhuma correcção de integração necessária nesta passagem (imports/exports estáveis após wave).

---

## 4. P0 — auditoria read-only (protegido)

| Invariante | Estado | Evidência |
|------------|--------|-----------|
| Leave acordo via RPC `leave_passenger` | **OK** | `AgreementService.leavePassenger` → `supabase.rpc('leave_passenger')`; sem `.update` no serviço |
| Leave grupo via RPC `leave_grupo_membro` | **OK** (follow-up) | `GrupoService.sairDoGrupo` → RPC; DEFINER: self-only, bloqueia único activo, sync `n_candidato`, **não** toca `propostas` |
| Sem UPDATE client em `propostas` / `acordos` / `acordos_passageiros` / `lista_espera` | **OK** | Grep serviços: zero `.update` nessas tabelas; mutações via `accept_proposal` / `reject_proposal` / `cancel_proposal` / `leave_passenger` / `promote_waitlist` / `renegotiate_*` |
| RLS UPDATE nas 4 tabelas críticas | **OK** | Postgres: **nenhuma** policy UPDATE client nessas tabelas |
| `membros_grupo` self ≠ `activo`→`saiu` via client | **OK** | Policy `membros_update_self_reabrir_pendente`: USING estados rejeitado/saiu/pendente; WITH CHECK só `pendente`. Saída só via RPC |
| Join / auto-aprovação fechada | **OK** | `pedirEntradaGrupo` → `pendente`; `aprovarEntrada` exige organizador (+ teste P0); RLS owner-only para activar |
| RPCs marketplace presentes no projecto `boleia` | **OK** | `accept_proposal`, `reject_proposal`, `cancel_proposal`, `leave_passenger`, `leave_grupo_membro`, `promote_waitlist`, `renegotiate_agreement_pricing`, `apply_due_agreement_adendas` |

---

## 5. Checklist auditoria (aceitação + AUDIT_GAPS)

| Tema | Resultado | Notas |
|------|-----------|-------|
| Pricing dual + resto | **GREEN** | `resolveAgreementPricing` + AgreementsE2E; UI «Por passageiro» / «Total do acordo» |
| Capacidade vs N | **GREEN** | `canAcceptDirectly` / waitlist; sem divisor por vagas no preço |
| Leave acordo (quotas congeladas) | **GREEN** | RPC; E2E leave não altera cabeçalho/quotas restantes |
| Leave grupo atómico | **GREEN** | RPC `leave_grupo_membro` (novo nesta wave) |
| Waitlist promote sem auto-aceitar | **GREEN** | `promote_waitlist` RPC; hook leave best-effort no servidor |
| Quatro Ns | **GREEN** | Snapshot N_proposto imutável; N_actual sync; N_contrato só adenda; N_activos lotação |
| Grupos vivos / incompletos negociáveis | **GREEN** | Panel + serviço; aviso N_actual ≠ N_proposto |
| Propostas A/B + contraparte | **GREEN** | Inbox filter; cancel criador; reject/accept contraparte |
| No self-accept / self-reject | **GREEN** | Gates serviço + RPC `created_by` |
| Flex sem OD | **GREEN** | Publish + OfertaService + matching ignora geo em flex |
| Matching dias + bidireccional | **GREEN** | `isDaysCompatible` + findCompatible* |
| Acordo 1:N | **GREEN** | MyAgreements + accept_proposal |
| Adenda temporal | **GREEN** | Agenda próximo mês; copy UI alinhada; `acordos_adendas` |
| UI vs backend | **GREEN** | Cancel/inbox/flex/adenda wired a RPCs |
| RLS / RPC | **GREEN** | Ver §4 (MCP SQL) |
| Notificações / deep links | **GREEN** | `notificationRouter` inbox passageiro\|motorista |

### Dívida de cobertura (P1 não crítico — de `AUDIT_GAPS_WAVE`)

Continua útil como backlog de testes (não regressão observada na integração):

| Gap | Prioridade | Notas |
|-----|------------|-------|
| G1 Aceite cancela outras propostas abertas | P1 cobertura | RPC `accept_proposal` menciona cancel/aberta; falta assert Vitest dedicado |
| G2 N_actual < N_proposto ⇒ accept falha | P1 cobertura | Regra servidor; mock E2E em falta |
| G3 Aceite por `ordem_insercao` | P1 cobertura | Idem |
| G4 Capacidade multi-acordo mesma oferta | P1 cobertura | |
| G5 Leave→promote E2E mock | P1 cobertura | Já no servidor leave_passenger |
| G6–G12 | P1/P2 | Sense B created_by, router waitlist, falta numérica, overbooking MCP, jargon smoke |

Sugestão pós-commit: `MarketplaceAuditScenarios.test.jsx` (blocos A–E do observer).

---

## 6. Actualização CHECKPOINT

Secção «Wave paralelismo» adicionada em `CHECKPOINT.md` (uncommitted). P0 inclui `leave_grupo_membro`.

---

## 7. Blockers restantes

**Nenhum blocker P0/P1 crítico para merge lógico.**

Menores / recomendados antes ou após commit:

1. Suite de cenários A–E (`MarketplaceAuditScenarios`) — dívida G1–G5.  
2. Smoke browser QA com contas CHECKPOINT (opcional).  
3. Separar commits por task (T29…T35 + wave hardening) — não misturar `.agent`/`.cursor` lixo.  
4. Ruído ECONNREFUSED :54321 em ambientes sem Supabase local (ignorar ou mockear).

---

## 8. Mensagem de commit sugerida (NÃO executar)

Opção monolith (se o utilizador pedir um único commit da wave):

```
feat(marketplace): wave paralela — matching, grupo/RPC leave, propostas A/B, adenda temporal, flex UX

Fecha mid-edit da wave; leave_grupo_membro + cancel_proposal; 413 testes verdes.
```

Preferível (separado, alinhado ao CHECKPOINT):

```
feat(marketplace): T35 matching dual + hardening filters
feat(marketplace): grupo vivo + leave_grupo_membro RPC
feat(marketplace): propostas A/B cancel/inbox/deep links
feat(marketplace): adenda temporal acordos_adendas
feat(marketplace): flex UX hubs + OfertaMatchCard
chore(marketplace): WAVE_PARALLEL_REPORT + CHECKPOINT wave
```

---

## 9. Caminhos

- Relatório: `.specs/features/marketplace-oferta-procura/WAVE_PARALLEL_REPORT.md`
- Gaps observer: `.specs/features/marketplace-oferta-procura/AUDIT_GAPS_WAVE.md`
- Checkpoint: `.specs/features/marketplace-oferta-procura/CHECKPOINT.md`
