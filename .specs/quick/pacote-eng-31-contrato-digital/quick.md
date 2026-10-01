# ENG#31 — Contrato digital avaliação/MVP (P1)

## Goal
Snapshot legível de contrato (preço, modalidade, N_contrato, totais) no aceite e no detalhe do acordo. IBAN+comprovativo intactos.

## Acceptance
- AC1: Detalhe acordo — motorista e passageiro veem modalidade, N, total, por pessoa (PT-PT).
- AC2: Aceite — modal de confirmação inclui snapshot antes de criar acordo.
- AC3: Valores só de campos resolvidos do acordo/proposta — sem defaults de plataforma.
- AC4: IBAN/comprovativo inalterados.
- AC5: Sem regressão ENG#33/#34 (#146–#148).

## Design
- `buildAcordoContratoSnapshot` + `AcordoContratoSnapshot.jsx` (reutiliza `labelModoPreco`, campos `acordos.*`).
- MyAgreements: substituir bloco «Preço combinado» parcial pelo snapshot estruturado.
- PropostaReviewCard: snapshot no `ConfirmationModal` de aceite.

## Out of scope
PDF/e-sign, escrow novo, #32/#35/Pack B.
