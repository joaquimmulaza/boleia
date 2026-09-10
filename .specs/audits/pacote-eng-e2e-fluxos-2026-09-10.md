# PACOTE ENG — Auditoria E2E fluxos Boleia

**Data:** 2026-09-10  
**Pedido:** Joaquim (explícito)  
**Branch auditada:** `main` @ `44a73f6`  
**Método:** mapa serviços/RPC/migrações → Vitest PacoteEng* + G1–G15 → grep OD/defaults/auto-aceite → priorização piloto Viana↔Talatona  
**Browser E2E live:** não executado (sem credenciais Supabase piloto neste ambiente); evidência = testes + SQL + UI mocks.

---

## 1. Sumário executivo

Os **10 fluxos pedidos estão implementados em código/SQL** com cobertura de aceitação PacoteEng (173/173 verdes nos PacoteEng* + MarketplaceAudit). A suite global tem **7 testes vermelhos** por **mock drift** pós `seat-before-custody` (`.in('estado', ['activo','reservado'])`) — não indica regressão de produção comprovada.

**Bloqueadores reais para 1.º acordo piloto Viana↔Talatona:**

| # | Gap | Porquê bloqueia |
|---|-----|-----------------|
| B1 | Sem **TTL de reservas** (`reservado` indefinido) | Aceite ocupa vaga até pagamento/admin; abandono trava capacidade da oferta |
| B2 | **`VITE_PLATFORM_IBAN`** obrigatório em deploy | Passageiro não vê IBAN para transferência (`AcordoPagamentoPanel`) |
| B3 | **Validação admin manual** (`admin_validate_payment`) | Transição `reservado→activo` / `comprovativo→em_custodia` exige operador |
| B4 | **IBAN motorista** no perfil para repasse | `admin_liquidate_period` falha sem IBAN (PacoteEng13) |

**Worth (não bloqueiam piloto mínimo):** mocks Vitest desactualizados; OnboardingPermissions integration (push soft-prompt); migrações seat-before-custody duplicadas (monolito + split).

---

## 2. Tabela fluxos → PASS | FAIL | Partial

| # | Fluxo | Veredito | Evidência |
|---|--------|----------|-----------|
| 1 | Browse pós-login (flexível sem OD inventada) | **PASS** | `PassengerDashboard.test.jsx` (feed browse + flex label); `OfertaService.js` + `labelRotaOferta`; `FlexMatchingRegression.test.js`; `PacoteEng4` (AGENTS §9) |
| 2 | Proposta snapshot + só contraparte (anti auto-aceite) | **PASS** | `PacoteEng2Acceptance.test.js` §3; `PacoteEng3Acceptance.test.js`; SQL `20260905094819_marketplace_t32_accept_reject_contraparte.sql`; `propostaInbox.js`; `MarketplaceAuditScenarios` G17/G18 |
| 3 | Aceite → reservado → em_custodia → activo | **PASS** | `SeatBeforeCustodyAcceptance.test.js`; `20260907190530_seat_before_custody_accept_proposal.sql`; `20260907190449_*_pagamento_trigger.sql`; `admin_validate_payment` promove `reservado→activo`; UI `acordoPassageiroStatus.js` |
| 4 | Pagamento IBAN + comprovativo + gate contactos | **Partial** | **PASS** contrato: `PacoteEng5Acceptance.test.js`, `AcordoPagamentoPanel.test.jsx`, `MyAgreements.test.jsx` (deep-link `focus=pagamento`); **GAP** deploy: `VITE_PLATFORM_IBAN`; **GAP** ops: admin valida comprovativo |
| 5 | Assiduidade / faltaDesconto gated a pagamento | **PASS** | `PacoteEng11Acceptance.test.js`; `FaltaIdaRegressoAcceptance.test.js`; SQL `handle_falta_desconto` + `log_falta`; UI gates `allowsAssiduidadeFaltas` em `MyAgreements` / `AbsenceTracker` |
| 6 | Liquidação / repasse take-rate ~10% | **PASS** | `PacoteEng13Acceptance.test.js` (`TAKE_RATE_PCT=0.1`); `AdminPagamentos.test.jsx`; RPC `admin_liquidate_period` |
| 7 | Renovação M0→M1 | **PASS** | `PacoteEng14Acceptance.test.js`; RPC `renew_agreement_period` / `decline_agreement_renewal`; deep-link `renewal_available` |
| 8 | Saída parcial + cancelamento | **Partial** | **PASS** saída: `PacoteEng15Acceptance.test.js`; **PASS** SQL cancelamento: `20260907180000_eng8b_s22_fecho_*.sql`, `TerminateAuditG15.test.jsx` (9/10); **FAIL** 1 teste mock `getAgreementsForPassenger` (`.in` não mockado) |
| 9 | Pedido entrada grupo | **PASS** | `PacoteEng12Acceptance.test.js`; `GrupoDescobertaPanel.test.jsx`; `GrupoProcuraPanel.test.jsx`; migração `20260904213324_t31_grupos_n_maximo_pedidos_entrada.sql` |
| 10 | Push / PWA deep-links | **Partial** | **PASS** router: `PacoteEng16Acceptance.test.js`, `notificationRouter.test.js`, `sw.js` (`notificationclick` → `resolveNotificationRoute`); **FAIL** `OnboardingPermissions.integration.test.jsx` (3/4 — depende Supabase live) |

---

## 3. Execução Vitest (2026-09-10)

### PacoteEng + audit core (verde)

```
npm run test:run -- src/services/PacoteEng*.test.js \
  src/services/SeatBeforeCustodyAcceptance.test.js \
  src/services/FlexMatchingRegression.test.js \
  src/pages/MarketplaceAuditScenarios.test.jsx
→ 13 files, 173 tests PASS
```

### Suite completa

```
npm run test:run
→ 110 files | 868 PASS | 7 FAIL
```

| Teste falhado | Causa provável | Impacto produto |
|---------------|----------------|-----------------|
| `AgreementsE2E` renegotiate adenda | mock `supabase.from().in` ausente | Nenhum (drift teste) |
| `TerminateAuditG15` apply_due on load | idem `.in('estado',…)` | Nenhum |
| `DriverDashboard` Aceitar proposta | expect `('prop-1')` vs `('prop-1', { memberIds })` | Nenhum — comportamento correcto pós-picker grupo |
| `AbsenceService.marketplace` | `supabase.rpc` não mockado | Nenhum |
| `OnboardingPermissions.integration` ×3 | integração Supabase real indisponível | Push soft-prompt não validado E2E |

---

## 4. Grep — OD fabricada, defaults preço, auto-aceite

| Verificação | Resultado |
|-------------|-----------|
| OD inventada em flexível | **OK** — `labelRotaOferta` → «Oferta flexível» + «Sem origem/destino fixos»; testes explícitos em `PassengerDashboard`, `DriverDashboard`, `MyAgreements` |
| Defaults plataforma de preço | **OK** — `paymentStatus.js` L3: «Valores monetários vêm sempre do acordo»; `PacoteEng2` §4; grep migrações sem DEFAULT preço mensal |
| Auto-aceite / promote silencioso | **OK** — `PacoteEng9`: `promoteWaitlist` não chama `accept_proposal`; SQL `promote_waitlist` sem referência a acordos |
| Criador aceita própria proposta | **OK** — RPC `IF v_uid = v_prop.created_by THEN RAISE` + testes PacoteEng2/3 |

---

## 5. Piloto Viana↔Talatona — priorização

Rota fixa ~15–25 km: **matching exige OD Photon** (`countrycode=ao`, raio 2500 m origem/destino, ±15 min) — utilizadores devem seleccionar sugestões OSM (ex. Viana, Talatona) **sem defaults da plataforma**.

| Prioridade | Acção |
|------------|--------|
| **Blocker** | Configurar `VITE_PLATFORM_IBAN` + operador admin para validar 1.º comprovativo |
| **Blocker** | Motorista: veículo + oferta fixa Viana→Talatona (ou flexível se piloto aceitar sem OD na UI) |
| **Blocker** | Definir política TTL `reservado` (não existe RPC/cron) antes de escala |
| **Worth** | Repor mocks `.in()` nos 3 testes AgreementService-dependent |
| **Worth** | Actualizar `DriverDashboard.test.jsx` expectativa `memberIds` |
| **Worth** | Smoke browser autenticado pós-deploy (fora scope desta auditoria) |

---

## 6. Ficheiros / RPCs implicados (por fluxo)

| Fluxo | Serviços | RPCs / migrações chave | UI |
|-------|----------|------------------------|-----|
| 1 Browse | `OfertaService.listOfertasDisponiveis`, `MatchingService` | — | `/passageiro` `PassengerDashboard` |
| 2 Proposta | `PropostaService`, `propostaReview`, `propostaInbox` | `accept_proposal`, `reject_proposal`, `cancel_proposal` | `PropostaReviewCard`, hubs |
| 3 Custody | `AgreementService.createAgreementFromProposal`, `PaymentService.adminValidatePayment` | `accept_proposal`, `admin_validate_payment`, seat-before-custody migrações | `MyAgreements`, `acordoPassageiroStatus` |
| 4 Pagamento | `PaymentService` | `submit_payment_proof`, `get_acordo_contactos` | `AcordoPagamentoPanel`, `AcordoContactosPanel` |
| 5 Faltas | `AbsenceService` | `log_falta`, trigger `handle_falta_desconto` | `/faltas`, `MyAgreements` |
| 6 Repasse | `PaymentService` | `admin_liquidate_payment`, `admin_liquidate_period` | `/admin/pagamentos` |
| 7 Renovação | `AgreementService` | `renew_agreement_period`, `apply_due_agreement_non_renewals` | `MyAgreements` CTAs renovação |
| 8 Saída/cancel | `AgreementService` | `leave_passenger`, `terminate_agreement`, `apply_due_agreement_terminations` | `MyAgreements`, modais ENG#8 |
| 9 Grupo | `GrupoService` | `pedir_entrada` (via insert pendente), `aprovar_entrada`, `leave_grupo_membro` | `GrupoProcuraPanel`, `GrupoDescobertaPanel` |
| 10 Push/PWA | — | `notify_domain_event` (ENG#16) | `notificationRouter.js`, `sw.js`, `NotificationBell` |

---

## 7. Critérios de aceitação sugeridos (blockers)

### B1 — TTL reservas

- [ ] RPC ou job `expire_stale_reservas` liberta lugares `reservado` após N horas/dias sem `comprovativo_enviado`
- [ ] `oferta_ocupacao` deixa de contar reservas expiradas
- [ ] Notificação `reserva_expirada` ao passageiro (opcional MVP)
- [ ] Teste Vitest + migração Supabase MCP

### B2 — IBAN plataforma em produção

- [ ] `VITE_PLATFORM_IBAN` definido no Vercel/preview piloto
- [ ] `AcordoPagamentoPanel` mostra IBAN (teste manual ou `getPlatformIban` ≠ null)

### B3 — Fluxo admin piloto documentado

- [ ] Operador com `perfis.is_admin` acede `/admin/pagamentos`
- [ ] Aprovar comprovativo → passageiro `activo` + contactos desbloqueados (`get_acordo_contactos`)

### B4 — IBAN motorista antes de liquidação

- [ ] Perfil motorista com `iban` + `iban_titular` preenchidos antes de `admin_liquidate_period`

---

## 8. Decisão PR

**Sem PR de código funcional** nesta corrida — lacunas B1–B4 são operacionais/feature TTL, não fixes triviais de uma linha. Recomendado follow-up: TTL reservas (spec + MCP) e refresh mocks Vitest `.in()`.
