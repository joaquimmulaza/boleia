# PACOTE ENG #13 — Liquidação período + take-rate ~10% + repasse motorista

## Objetivo

Período liquidado on-platform → plataforma retém ~10% → motorista recebe líquido (IBAN perfil).

Extende ENG #5 (escrow) e ENG #11 (assiduidade gate) com **registo de repasse** e **liquidação por período**.

## Acceptance

1. Liquidação só sobre GMV on-platform (`em_custodia` → `liquidado`)
2. Take-rate ~10%; motorista recebe líquido após período (payout − faltas)
3. faltaDesconto/assiduidade no cálculo só se gated a pagamento (#11)
4. Sem paga no carro; IBAN motorista no perfil (obrigatório para repasse)
5. Admin vê/valida liquidação; idempotência; valores do acordo — NUNCA defaults plataforma
6. CTAs só com auth

## Entregáveis

- Tabela `repasses_motorista` (agregado por motorista + `mes_referencia`)
- RPC `admin_liquidate_period` (batch) + `admin_liquidate_payment` com idempotência + `repasse_id`
- Client `PaymentService` + admin UI secção período/repasses
- Testes `PacoteEng13Acceptance.test.js`
