# PACOTE ENG #11 — Assiduidade + faltaDesconto (gate pagamento)

**Scope:** Medium (1 migração + RPCs + guards client + testes contrato)

## Objetivo

Faltas/descontos e liquidação só com pagamento on-platform (`em_custodia`). Anti-leakage: sem pagamento validado → sem desconto nem registo válido para repasse.

## Regras

1. **Sem `em_custodia`** → RPC `log_falta` rejeita; trigger `handle_falta_desconto` força `desconto_kz = 0`.
2. **Com `em_custodia`** → registo falta + desconto conforme quota/dias do acordo.
3. **Liquidação** → RPC `admin_liquidate_payment`: payout = `valor_payout_liquido_kz` − Σ descontos faltas do mês (passageiro + motorista).
4. **UI** → CTAs «Registar falta» desactivados até pagamento em custódia; valores sempre do acordo.

## Diff mínimo

1. Migração `20260907020000_pacote_eng11_assiduidade_faltadesconto_gate.sql`
2. `paymentStatus.allowsAssiduidadeFaltas` + `AbsenceService.logAbsence` → RPC
3. Gates em `MyAgreements` + `AbsenceTracker`
4. `adminLiquidatePayment` + botão admin
5. `PacoteEng11Acceptance.test.js`

## Verificação

`npm run test:run -- src/services/PacoteEng11Acceptance.test.js src/utils/paymentStatus.test.js src/services/AbsenceService.test.js src/pages/AbsenceTracker.test.jsx`
