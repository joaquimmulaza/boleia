# PACOTE ENG — Auditoria E2E fluxos Boleia

**Data:** 2026-09-10  
**Actualização PACOTE #20:** 2026-09-10  
**Branch auditada:** `main` @ `e8a57fa` + fix `cursor/pacote-eng-20-e2e-partial-1375`  
**Método:** mapa serviços/RPC/migrações → Vitest PacoteEng* + G1–G15 → grep OD/defaults/auto-aceite → `PacoteEng20Acceptance.test.js`

---

## 1. Sumário executivo

Os **10 fluxos pedidos estão implementados** com cobertura PacoteEng + audit core. **PACOTE #20** fechou os Partials **4, 8, 10** (mocks drift + evidência E2E dedicada).

**Suite completa (pós #20):** `112 files | 907 PASS | 0 FAIL`

---

## 2. Tabela fluxos → PASS | FAIL | Partial

| # | Fluxo | Veredito | Evidência |
|---|--------|----------|-----------|
| 1 | Browse pós-login (flexível sem OD inventada) | **PASS** | `PassengerDashboard.test.jsx`; `PacoteEng4` |
| 2 | Proposta snapshot + só contraparte | **PASS** | `PacoteEng2`/`PacoteEng3`; `MarketplaceAuditScenarios` G17/G18 |
| 3 | Aceite → reservado → em_custodia → activo | **PASS** | `SeatBeforeCustodyAcceptance`; ENG#18 TTL |
| 4 | Pagamento IBAN + comprovativo + gate contactos | **PASS** | `PacoteEng5Acceptance`; **`PacoteEng20Acceptance` §4** (happy path upload→admin→contactos); `AcordoPagamentoPanel.test.jsx`; IBAN regressão `getPlatformIban` |
| 5 | Assiduidade / faltaDesconto gated | **PASS** | `PacoteEng11Acceptance`; `FaltaIdaRegressoAcceptance` |
| 6 | Liquidação / repasse take-rate ~10% | **PASS** | `PacoteEng13Acceptance`; `AdminPagamentos.test.jsx` |
| 7 | Renovação M0→M1 (lista audit original) | **PASS** | `PacoteEng14Acceptance` |
| 8 | Renovação M0→M1 (remap PACOTE #20) | **PASS** | **`PacoteEng20Acceptance` §8** — RPC explícita, herança termos, M1 `pendente_pagamento`, sem cron |
| 9 | Pedido entrada grupo | **PASS** | `PacoteEng12Acceptance`; `GrupoDescobertaPanel.test.jsx` |
| 10 | Push / PWA deep-links + grupo entrada | **PASS** | **`PacoteEng20Acceptance` §10**; `PacoteEng16Acceptance`; `OnboardingPermissions.integration.test.jsx` (mock, sem Supabase live); `notificationRouter.test.js`; `sw.js` |

---

## 3. PACOTE #20 — fixes aplicados

| Fix | Ficheiro | Causa |
|-----|----------|-------|
| Mock `.in('estado', …)` | `AgreementsE2E.test.jsx`, `TerminateAuditG15.test.jsx` | drift pós seat-before-custody |
| `createAgreementFromProposal(..., { memberIds })` | `DriverDashboard.test.jsx` | picker grupo |
| `supabase.rpc('log_falta')` | `AbsenceService.marketplace.test.js` | ENG#11 RPC gate |
| `markPermissionsEligible` + mocks | `OnboardingPermissions.integration.test.jsx` | soft-prompt defer; sem credenciais live |
| Evidência E2E 4/8/10 | `PacoteEng20Acceptance.test.js` | audit Partial → PASS |

---

## 4. Execução Vitest (pós #20)

```bash
npm run test:run -- src/services/PacoteEng20Acceptance.test.js
→ 1 file, 13 tests PASS

npm run test:run
→ 112 files, 907 tests PASS
```

---

## 5. Bloqueadores operacionais piloto (inalterados)

| # | Gap | Nota |
|---|-----|------|
| B2 | `VITE_PLATFORM_IBAN` em deploy | regressão coberta em PacoteEng20 §4 |
| B3 | Admin manual `admin_validate_payment` | happy path mock + OPS ENG#18 |
| B4 | IBAN motorista liquidação | PacoteEng13/18 |

B1 TTL reservas: **ENG#18 Done** (`apply_due_reserva_expiry`).
