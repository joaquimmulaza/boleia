# Quick — UI Audit Gaps (Tasks 4, 6, 19)

**Data:** 2026-09-06  
**Modo:** Quick / Spec leve (follow-up de `prompts-and-audit.md`)  
**UI Skills:** `ibelick/baseline-ui` (spacing, text-balance/pretty, min touch, modeless errors)

## Objectivo

Fechar gaps UI: picker de membros no aceite, rejeitar adenda, telefone como fallback colapsável.

## Estados UI

### Task 4 — Picker membros (`PropostaReviewCard`)
- Default: lista snapshot = tamanho da proposta; Aceitar activo.
- `requiresMemberSelection` (grupo com mais activos do que lugares na proposta): checkboxes modeless; Aceitar só com exactamente N seleccionados; copy humana (sem N_*).
- Confirmação → `onAceitar(selectedMemberIds)` → `acceptProposal` / `createAgreementFromProposal(..., { memberIds })`.

### Task 6 — Adenda (`MyAgreements`)
- Pendente (passageiro): «Aceitar Alteração» (primário, ≥48px) + «Rejeitar Alteração» (secundário distinto, Fitts).
- Feedback modeless via `FeedbackAlert`.
- Quotas no ecrã usam divisor contratual (`N_contrato` / campos congelados) — sem recálculo por headcount vivo.

### Task 19 — Telefone (`GrupoProcuraPanel`)
- Discovery / membros / pedidos no viewport principal.
- Telefone (+ WhatsApp auxiliar) em secção colapsável «Fallback: Convidar por telefone».

## Componentes
- shadcn/`Button`, checkboxes nativos acessíveis, `FeedbackAlert`, `ConfirmationModal`
- Tokens: `primary`, amber (aviso), slate (secundário), coral/outline para rejeitar

## Dependências DB (agente DB)
- RPC `accept_proposal` com `p_member_ids uuid[]` (obrigatório quando composição explícita)
- RPC `reject_agreement_adenda(p_adenda_id)` (+ estados bilaterais)

## Verify
`npm run test:run -- src/components/PropostaReviewCard.test.jsx src/utils/propostaReview.test.js src/pages/MyAgreements.test.jsx src/components/GrupoProcuraPanel.test.jsx src/services/AgreementService.test.js src/services/PropostaService.test.js`
