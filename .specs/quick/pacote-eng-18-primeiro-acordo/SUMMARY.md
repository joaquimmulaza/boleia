# PACOTE ENG #18 — SUMMARY

**Branch:** `cursor/pacote-eng-18-primeiro-acordo-3dcb`  
**Migração remota:** `pacote_eng18_ttl_reserva_iban_gate` (+ part2/part3 MCP) em `fdclrbcgytnuqcrpsevw`

## Entregue

| AC | Mudança |
|----|---------|
| B1 | `reservado_expira_em` (72h), RPC `apply_due_reserva_expiry`, estado `expirado`, UI banner/chip |
| B3 | `OPS.md` + guia inline `/admin/pagamentos` tab Validar |
| B4 | Gate `iban` + `iban_titular` em liquidação; aviso admin; erro PT |

## Testes

`PacoteEng18Acceptance.test.js` + regressão SeatBeforeCustody / Eng5 / Eng13 / AdminPagamentos.
