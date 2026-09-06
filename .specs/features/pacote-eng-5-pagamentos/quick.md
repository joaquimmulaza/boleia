# PACOTE ENG #5 — Pagamento com status + escrow comprovativo

**Scope:** Medium (schema + RPCs + storage + UI mínima + testes contrato)

## Objetivo

Estado de pagamento mensal por lugar (`acordos_passageiros`), comprovativo em Storage privado, hard-gate de contactos até `em_custodia`, IBAN motorista no perfil, admin valida/rejeita. Valores sempre do acordo; take-rate ~10% documentado no payout líquido.

## Estados

`pendente_pagamento` → `comprovativo_enviado` → `em_custodia` → `liquidado` | `reembolsado`

Rejeição admin: `comprovativo_enviado` → `pendente_pagamento`.

## Diff mínimo

1. **Schema** — `pagamentos_acordo` (FK acordo + linha passageiro; `valor_kz` = quota congelada); `perfis.iban`, `iban_titular`, `is_admin`; trigger pós-insert `acordos_passageiros`.
2. **Storage** — bucket privado `comprovativos-pagamento` + RLS (passageiro próprio; admin leitura).
3. **RPCs** — `submit_payment_proof`, `admin_validate_payment`, `get_acordo_contactos` (SECURITY DEFINER).
4. **Client** — `PaymentService`, utils take-rate; Profile IBAN motorista; bloco pagamento + contactos em `MyAgreements`; `/admin/pagamentos`.
5. **Testes** — `PacoteEng5Acceptance.test.js` (state machine, gate, SQL, take-rate).

## Fora de scope

ProxyPay/Multicaixa, polish Critiquito (#6).

## Verificação

`npm run test:run -- src/services/PacoteEng5Acceptance.test.js src/utils/paymentStatus.test.js src/services/PaymentService.test.js`
